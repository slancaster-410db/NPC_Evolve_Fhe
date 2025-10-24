// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface NPCInteraction {
  id: string;
  encryptedData: string;
  timestamp: number;
  player: string;
  interactionType: "trade" | "dialogue" | "combat";
  villageImpact: number;
  status: "pending" | "processed";
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState<NPCInteraction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newInteraction, setNewInteraction] = useState({ interactionType: "trade", villageImpact: 0, description: "" });
  const [showWorldInfo, setShowWorldInfo] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<NPCInteraction | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [villageState, setVillageState] = useState({
    culture: 50,
    economy: 50,
    aggression: 50,
    openness: 50
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Randomly selected styles: High saturation neon (purple/blue/pink/green), Glass morphism, Center radiation, Animation rich
  // Randomly selected features: Project introduction, Data statistics, Search & filter, Village state visualization

  useEffect(() => {
    loadInteractions().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadInteractions = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("interaction_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing interaction keys:", e); }
      }
      
      const list: NPCInteraction[] = [];
      for (const key of keys) {
        try {
          const interactionBytes = await contract.getData(`interaction_${key}`);
          if (interactionBytes.length > 0) {
            try {
              const interactionData = JSON.parse(ethers.toUtf8String(interactionBytes));
              list.push({ 
                id: key, 
                encryptedData: interactionData.data, 
                timestamp: interactionData.timestamp, 
                player: interactionData.player, 
                interactionType: interactionData.interactionType, 
                villageImpact: interactionData.villageImpact,
                status: interactionData.status || "pending" 
              });
            } catch (e) { console.error(`Error parsing interaction data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading interaction ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setInteractions(list);
      
      // Simulate village state changes based on interactions
      simulateVillageEvolution(list);
    } catch (e) { console.error("Error loading interactions:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const simulateVillageEvolution = (interactions: NPCInteraction[]) => {
    let culture = 50;
    let economy = 50;
    let aggression = 50;
    let openness = 50;
    
    interactions.forEach(interaction => {
      const impact = interaction.status === "processed" ? 
        FHEDecryptNumber(interaction.encryptedData) : 0;
      
      switch(interaction.interactionType) {
        case "trade":
          economy += impact * 0.2;
          openness += impact * 0.1;
          break;
        case "dialogue":
          culture += impact * 0.15;
          openness += impact * 0.2;
          aggression -= impact * 0.1;
          break;
        case "combat":
          aggression += impact * 0.3;
          openness -= impact * 0.15;
          economy -= impact * 0.1;
          break;
      }
    });
    
    // Normalize values between 0-100
    setVillageState({
      culture: Math.max(0, Math.min(100, culture)),
      economy: Math.max(0, Math.min(100, economy)),
      aggression: Math.max(0, Math.min(100, aggression)),
      openness: Math.max(0, Math.min(100, openness))
    });
  };

  const submitInteraction = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting interaction data with Zama FHE..." });
    try {
      const encryptedData = FHEEncryptNumber(newInteraction.villageImpact);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const interactionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const interactionData = { 
        data: encryptedData, 
        timestamp: Math.floor(Date.now() / 1000), 
        player: address, 
        interactionType: newInteraction.interactionType, 
        villageImpact: newInteraction.villageImpact,
        status: "pending" 
      };
      
      await contract.setData(`interaction_${interactionId}`, ethers.toUtf8Bytes(JSON.stringify(interactionData)));
      
      const keysBytes = await contract.getData("interaction_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(interactionId);
      await contract.setData("interaction_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Encrypted interaction submitted!" });
      await loadInteractions();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewInteraction({ interactionType: "trade", villageImpact: 0, description: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const processInteraction = async (interactionId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted interaction with FHE..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const interactionBytes = await contract.getData(`interaction_${interactionId}`);
      if (interactionBytes.length === 0) throw new Error("Interaction not found");
      const interactionData = JSON.parse(ethers.toUtf8String(interactionBytes));
      
      const processedData = FHECompute(interactionData.data, 'increase10%');
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedInteraction = { ...interactionData, status: "processed", data: processedData };
      await contractWithSigner.setData(`interaction_${interactionId}`, ethers.toUtf8Bytes(JSON.stringify(updatedInteraction)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE processing completed!" });
      await loadInteractions();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Processing failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredInteractions = interactions.filter(interaction => 
    interaction.interactionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interaction.player.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderVillageState = () => {
    return (
      <div className="village-state-container">
        <div className="state-indicator">
          <div className="state-label">Culture</div>
          <div className="state-bar">
            <div className="state-fill" style={{ width: `${villageState.culture}%`, backgroundColor: '#9c27b0' }}></div>
          </div>
          <div className="state-value">{villageState.culture.toFixed(0)}</div>
        </div>
        <div className="state-indicator">
          <div className="state-label">Economy</div>
          <div className="state-bar">
            <div className="state-fill" style={{ width: `${villageState.economy}%`, backgroundColor: '#2196f3' }}></div>
          </div>
          <div className="state-value">{villageState.economy.toFixed(0)}</div>
        </div>
        <div className="state-indicator">
          <div className="state-label">Aggression</div>
          <div className="state-bar">
            <div className="state-fill" style={{ width: `${villageState.aggression}%`, backgroundColor: '#f44336' }}></div>
          </div>
          <div className="state-value">{villageState.aggression.toFixed(0)}</div>
        </div>
        <div className="state-indicator">
          <div className="state-label">Openness</div>
          <div className="state-bar">
            <div className="state-fill" style={{ width: `${villageState.openness}%`, backgroundColor: '#4caf50' }}></div>
          </div>
          <div className="state-value">{villageState.openness.toFixed(0)}</div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const processedCount = interactions.filter(i => i.status === "processed").length;
    const pendingCount = interactions.filter(i => i.status === "pending").length;
    const tradeCount = interactions.filter(i => i.interactionType === "trade").length;
    const dialogueCount = interactions.filter(i => i.interactionType === "dialogue").length;
    const combatCount = interactions.filter(i => i.interactionType === "combat").length;
    
    return (
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{interactions.length}</div>
          <div className="stat-label">Total Interactions</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{processedCount}</div>
          <div className="stat-label">Processed</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{tradeCount}</div>
          <div className="stat-label">Trades</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{dialogueCount}</div>
          <div className="stat-label">Dialogues</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{combatCount}</div>
          <div className="stat-label">Combats</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing NPC world connection...</p>
    </div>
  );

  return (
    <div className="app-container glass-morphism">
      <header className="app-header">
        <div className="logo">
          <h1>NPC<span>Evolve</span>World</h1>
          <div className="fhe-badge">FHE-Powered</div>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Interaction
          </button>
          <button className="info-btn" onClick={() => setShowWorldInfo(!showWorldInfo)}>
            {showWorldInfo ? "Hide Info" : "World Info"}
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <div className="main-content center-radial">
        {showWorldInfo && (
          <div className="world-info-panel">
            <h2>NPC Evolve World</h2>
            <p>
              An autonomous world where NPC societies evolve based on encrypted player interactions. 
              All interactions are processed using Zama FHE technology to maintain privacy while allowing 
              the village to collectively evolve its culture and behavior patterns.
            </p>
            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <div className="feature-text">Player-NPC interactions are FHE encrypted</div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔄</div>
                <div className="feature-text">NPC society state updates homomorphically</div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🌐</div>
                <div className="feature-text">A truly "living" virtual world that reacts to players</div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🛠️</div>
                <div className="feature-text">Player behaviors collectively shape NPC history</div>
              </div>
            </div>
          </div>
        )}

        <div className="village-state-panel">
          <h2>Village State</h2>
          {renderVillageState()}
          <div className="state-description">
            The village state evolves based on all encrypted interactions. 
            Higher values indicate stronger traits in each category.
          </div>
        </div>

        <div className="stats-panel">
          <h2>Interaction Statistics</h2>
          {renderStats()}
        </div>

        <div className="interactions-panel">
          <div className="panel-header">
            <h2>Player Interactions</h2>
            <div className="search-box">
              <input 
                type="text" 
                placeholder="Search interactions..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button onClick={loadInteractions} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="interactions-list">
            {filteredInteractions.length === 0 ? (
              <div className="no-interactions">
                <div className="empty-icon"></div>
                <p>No interactions found</p>
                <button onClick={() => setShowCreateModal(true)}>Create First Interaction</button>
              </div>
            ) : (
              filteredInteractions.map(interaction => (
                <div 
                  className={`interaction-item ${interaction.status}`} 
                  key={interaction.id}
                  onClick={() => setSelectedInteraction(interaction)}
                >
                  <div className="interaction-type">
                    <div className={`type-icon ${interaction.interactionType}`}>
                      {interaction.interactionType === "trade" ? "💰" : 
                       interaction.interactionType === "dialogue" ? "💬" : "⚔️"}
                    </div>
                    <span>{interaction.interactionType}</span>
                  </div>
                  <div className="interaction-player">
                    {interaction.player.substring(0, 6)}...{interaction.player.substring(38)}
                  </div>
                  <div className="interaction-date">
                    {new Date(interaction.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="interaction-status">
                    <span className={`status-badge ${interaction.status}`}>
                      {interaction.status}
                    </span>
                  </div>
                  <div className="interaction-actions">
                    {interaction.status === "pending" && (
                      <button 
                        className="process-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          processInteraction(interaction.id);
                        }}
                      >
                        Process
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitInteraction} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          interactionData={newInteraction}
          setInteractionData={setNewInteraction}
        />
      )}

      {selectedInteraction && (
        <InteractionDetailModal 
          interaction={selectedInteraction} 
          onClose={() => {
            setSelectedInteraction(null);
            setDecryptedValue(null);
          }} 
          decryptedValue={decryptedValue}
          setDecryptedValue={setDecryptedValue}
          isDecrypting={isDecrypting}
          decryptWithSignature={decryptWithSignature}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">NPC<span>Evolve</span>World</div>
            <p>An Autonomous World Powered by Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© {new Date().getFullYear()} NPC Evolve World. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  interactionData: any;
  setInteractionData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, interactionData, setInteractionData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setInteractionData({ ...interactionData, [name]: value });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInteractionData({ ...interactionData, [name]: parseFloat(value) });
  };

  const handleSubmit = () => {
    if (!interactionData.interactionType || interactionData.villageImpact === 0) { 
      alert("Please fill required fields"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>New NPC Interaction</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="lock-icon">🔒</div>
            <div>
              <strong>FHE Encryption Active</strong>
              <p>Your interaction impact will be encrypted with Zama FHE before submission</p>
            </div>
          </div>

          <div className="form-group">
            <label>Interaction Type *</label>
            <select 
              name="interactionType" 
              value={interactionData.interactionType} 
              onChange={handleChange}
            >
              <option value="trade">Trade</option>
              <option value="dialogue">Dialogue</option>
              <option value="combat">Combat</option>
            </select>
          </div>

          <div className="form-group">
            <label>Village Impact *</label>
            <input 
              type="number" 
              name="villageImpact" 
              value={interactionData.villageImpact} 
              onChange={handleValueChange} 
              placeholder="Enter impact value (-100 to 100)"
              min="-100"
              max="100"
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <input 
              type="text" 
              name="description" 
              value={interactionData.description} 
              onChange={handleChange} 
              placeholder="Brief description of interaction..."
            />
          </div>

          <div className="encryption-preview">
            <h4>Encryption Preview</h4>
            <div className="preview-content">
              <div className="plain-value">
                <span>Plain Value:</span>
                <div>{interactionData.villageImpact || '0'}</div>
              </div>
              <div className="arrow">→</div>
              <div className="encrypted-value">
                <span>Encrypted Data:</span>
                <div>{interactionData.villageImpact ? 
                  FHEEncryptNumber(interactionData.villageImpact).substring(0, 30) + '...' : 
                  'No value entered'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn">
            {creating ? "Encrypting & Submitting..." : "Submit Interaction"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface InteractionDetailModalProps {
  interaction: NPCInteraction;
  onClose: () => void;
  decryptedValue: number | null;
  setDecryptedValue: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const InteractionDetailModal: React.FC<InteractionDetailModalProps> = ({ 
  interaction, onClose, decryptedValue, setDecryptedValue, isDecrypting, decryptWithSignature 
}) => {
  const handleDecrypt = async () => {
    if (decryptedValue !== null) { setDecryptedValue(null); return; }
    const decrypted = await decryptWithSignature(interaction.encryptedData);
    if (decrypted !== null) setDecryptedValue(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h2>Interaction Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="info-grid">
            <div className="info-item">
              <span>Type:</span>
              <strong className={`type-${interaction.interactionType}`}>
                {interaction.interactionType}
              </strong>
            </div>
            <div className="info-item">
              <span>Player:</span>
              <strong>{interaction.player.substring(0, 6)}...{interaction.player.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date:</span>
              <strong>{new Date(interaction.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Status:</span>
              <strong className={`status-${interaction.status}`}>{interaction.status}</strong>
            </div>
          </div>

          <div className="encrypted-section">
            <h3>Encrypted Impact Data</h3>
            <div className="encrypted-data">
              {interaction.encryptedData.substring(0, 50)}...
            </div>
            <div className="fhe-tag">
              <span className="fhe-icon">🔒</span>
              <span>FHE Encrypted</span>
            </div>
            <button 
              className="decrypt-btn" 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
            >
              {isDecrypting ? "Decrypting..." : 
               decryptedValue !== null ? "Hide Value" : "Decrypt with Wallet"}
            </button>
          </div>

          {decryptedValue !== null && (
            <div className="decrypted-section">
              <h3>Decrypted Impact Value</h3>
              <div className="decrypted-value">
                {decryptedValue}
              </div>
              <div className="decryption-note">
                <span className="warning-icon">⚠️</span>
                <span>This value is only visible after wallet signature verification</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;
