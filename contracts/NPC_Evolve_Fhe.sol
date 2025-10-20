pragma solidity ^0.8.24;
import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract NPCEvolveFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;
    mapping(uint256 => uint256) public totalSubmissionsInBatch;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    // Encrypted state
    euint32 public encryptedTotalPositiveInteractions;
    euint32 public encryptedTotalNegativeInteractions;
    euint32 public encryptedTotalNeutralInteractions;
    euint32 public encryptedTotalUniqueInteractingPlayers;
    euint32 public encryptedTotalInteractions;

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PauseToggled(bool indexed paused);
    event CooldownSecondsSet(uint256 indexed cooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event InteractionSubmitted(address indexed provider, uint256 indexed batchId, uint256 interactionCount);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, bytes32 stateHash);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 positive, uint256 negative, uint256 neutral, uint256 uniquePlayers, uint256 totalInteractions);

    // Custom Errors
    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosedOrInvalid();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidProof();
    error NotInitialized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor() {
        owner = msg.sender;
        _initIfNeeded();
        _openNewBatch(1);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        providers[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseToggled(_paused);
    }

    function setCooldownSeconds(uint256 _cooldownSeconds) external onlyOwner {
        cooldownSeconds = _cooldownSeconds;
        emit CooldownSecondsSet(_cooldownSeconds);
    }

    function openNewBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        _openNewBatch(currentBatchId);
    }

    function closeCurrentBatch() external onlyOwner whenNotPaused {
        if (currentBatchId == 0 || batchClosed[currentBatchId]) revert BatchClosedOrInvalid();
        batchClosed[currentBatchId] = true;
        emit BatchClosed(currentBatchId);
    }

    function submitInteractions(
        euint32 _encryptedPositive,
        euint32 _encryptedNegative,
        euint32 _encryptedNeutral,
        euint32 _encryptedUniquePlayers,
        euint32 _encryptedTotal
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (batchClosed[currentBatchId]) revert BatchClosedOrInvalid();

        lastSubmissionTime[msg.sender] = block.timestamp;

        _initIfNeeded();

        encryptedTotalPositiveInteractions = encryptedTotalPositiveInteractions.add(_encryptedPositive);
        encryptedTotalNegativeInteractions = encryptedTotalNegativeInteractions.add(_encryptedNegative);
        encryptedTotalNeutralInteractions = encryptedTotalNeutralInteractions.add(_encryptedNeutral);
        encryptedTotalUniqueInteractingPlayers = encryptedTotalUniqueInteractingPlayers.add(_encryptedUniquePlayers);
        encryptedTotalInteractions = encryptedTotalInteractions.add(_encryptedTotal);

        totalSubmissionsInBatch[currentBatchId]++;
        emit InteractionSubmitted(msg.sender, currentBatchId, totalSubmissionsInBatch[currentBatchId]);
    }

    function requestBatchDecryption() external onlyOwner whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (currentBatchId == 0 || !batchClosed[currentBatchId]) revert BatchClosedOrInvalid(); // Must be a valid, closed batch

        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        euint32[] memory ctsArray = new euint32[](5);
        ctsArray[0] = encryptedTotalPositiveInteractions;
        ctsArray[1] = encryptedTotalNegativeInteractions;
        ctsArray[2] = encryptedTotalNeutralInteractions;
        ctsArray[3] = encryptedTotalUniqueInteractingPlayers;
        ctsArray[4] = encryptedTotalInteractions;

        bytes32 stateHash = _hashCiphertexts(ctsArray);
        uint256 requestId = FHE.requestDecryption(ctsArray, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: currentBatchId,
            stateHash: stateHash,
            processed: false
        });
        emit DecryptionRequested(requestId, currentBatchId, stateHash);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        // @dev Replay protection: ensure this callback is processed only once for a given requestId.
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();

        // @dev State consistency: Rebuild the ciphertexts array from current contract storage
        // in the exact same order as during requestBatchDecryption.
        // This ensures that the state of the contract hasn't changed since the decryption was requested.
        euint32[] memory currentCts = new euint32[](5);
        currentCts[0] = encryptedTotalPositiveInteractions;
        currentCts[1] = encryptedTotalNegativeInteractions;
        currentCts[2] = encryptedTotalNeutralInteractions;
        currentCts[3] = encryptedTotalUniqueInteractingPlayers;
        currentCts[4] = encryptedTotalInteractions;
        bytes32 currentHash = _hashCiphertexts(currentCts);

        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatch();
        }

        // @dev Verify the proof of correct decryption from the FHE provider.
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidProof();
        }

        // Decode cleartexts in the same order they were requested
        uint256 positive = abi.decode(cleartexts.slice(0, 32), (uint256));
        uint256 negative = abi.decode(cleartexts.slice(32, 32), (uint256));
        uint256 neutral = abi.decode(cleartexts.slice(64, 32), (uint256));
        uint256 uniquePlayers = abi.decode(cleartexts.slice(96, 32), (uint256));
        uint256 totalInteractions = abi.decode(cleartexts.slice(128, 32), (uint256));

        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, decryptionContexts[requestId].batchId, positive, negative, neutral, uniquePlayers, totalInteractions);
    }

    function _initIfNeeded() internal {
        if (!encryptedTotalPositiveInteractions.isInitialized()) {
            encryptedTotalPositiveInteractions = FHE.asEuint32(0);
        }
        if (!encryptedTotalNegativeInteractions.isInitialized()) {
            encryptedTotalNegativeInteractions = FHE.asEuint32(0);
        }
        if (!encryptedTotalNeutralInteractions.isInitialized()) {
            encryptedTotalNeutralInteractions = FHE.asEuint32(0);
        }
        if (!encryptedTotalUniqueInteractingPlayers.isInitialized()) {
            encryptedTotalUniqueInteractingPlayers = FHE.asEuint32(0);
        }
        if (!encryptedTotalInteractions.isInitialized()) {
            encryptedTotalInteractions = FHE.asEuint32(0);
        }
    }

    function _requireInitialized(euint32 v) internal view {
        if (!v.isInitialized()) revert NotInitialized();
    }

    function _hashCiphertexts(euint32[] memory cts) internal pure returns (bytes32) {
        bytes32[] memory ctsAsBytes = new bytes32[](cts.length);
        for (uint i = 0; i < cts.length; i++) {
            ctsAsBytes[i] = FHE.toBytes32(cts[i]);
        }
        return keccak256(abi.encode(ctsAsBytes, address(this)));
    }

    function _openNewBatch(uint256 batchId) internal {
        // Initialize encrypted state for the new batch
        encryptedTotalPositiveInteractions = FHE.asEuint32(0);
        encryptedTotalNegativeInteractions = FHE.asEuint32(0);
        encryptedTotalNeutralInteractions = FHE.asEuint32(0);
        encryptedTotalUniqueInteractingPlayers = FHE.asEuint32(0);
        encryptedTotalInteractions = FHE.asEuint32(0);

        batchClosed[batchId] = false;
        totalSubmissionsInBatch[batchId] = 0;
        emit BatchOpened(batchId);
    }
}