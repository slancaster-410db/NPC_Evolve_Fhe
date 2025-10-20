# NPC Evolve: An Autonomous World Enriched by Encrypted Interactions 🌍✨

NPC Evolve is a revolutionary decentralized platform where non-player character (NPC) societies dynamically evolve based on encrypted interactions from players, all powered by **Zama's Fully Homomorphic Encryption technology** (FHE). Imagine a vibrant village where NPCs are not just static characters but living entities that adapt their culture and behavior based on every transaction, dialogue, and interaction with players—all while keeping data private and secure.

## The Problem at Hand 🤔

In today’s gaming landscape, player interactions with NPCs often lack depth and consequence. Traditional games use fixed algorithms to dictate NPC behavior, resulting in repetitive and unengaging experiences. In addition, there are pressing concerns around data privacy—how do games ensure that player interactions remain confidential while still offering immersive gameplay? This is where NPC Evolve steps in to transform the gaming experience.

## Zama’s FHE Solution 🔐

By leveraging **Fully Homomorphic Encryption**, NPC Evolve allows players to engage in a rich tapestry of interactions that are securely encrypted. This means every action performed by a player—whether it’s trading resources, initiating conversations, or acting in a hostile manner—is processed homomorphically. The NPC societies transform collectively, ensuring that player interactions meaningfully impact their evolving culture and behavior without revealing sensitive player data. This implementation utilizes Zama's open-source libraries, such as **Concrete** and **TFHE-rs**, making it easier for developers to integrate FHE into their own blockchain applications.

## Core Features 🌟

- **Encrypted Player-NPC Interactions:** Each interaction between players and NPCs is FHE encrypted, ensuring total confidentiality while maximizing engagement.
- **Dynamic NPC Societies:** NPCs evolve their behavior and culture based on the collective encrypted interactions from players, offering a responsive and engaging experience.
- **Real-time Updates:** NPC societies undergo macro state updates based on player behavior, allowing for a truly living virtual world that reacts to the community.
- **Immersive Simulation:** Delve into a sandbox-style environment, where each player’s choices contribute to the overarching history of the NPC world.
- **Analytics Dashboard:** Observation tools giving players insights into the evolving social states of NPC societies, enhancing player experience through analytical engagement.

## Technology Stack 🛠️

- **Zama SDK:** The heart of our confidential computing framework, providing essential tools for FHE.
- **Solidity:** For smart contract development.
- **Node.js:** Backend services to handle interactions and game logic.
- **Hardhat / Foundry:** Development environments for smart contract deployment and testing.

## Directory Structure 📁

Here is how the project directory is organized:

```
NPC_Evolve_Fhe/
├── contracts/
│   └── NPC_Evolve.sol
├── scripts/
│   └── deploy.js
├── tests/
│   └── NPC_Evolve.test.js
├── package.json
└── README.md
```

## Installation Steps 🛠️

Assuming you have already downloaded the project files, follow these steps to set up NPC Evolve:

1. **Install Node.js:** Ensure you have Node.js installed on your machine (preferably v14 or later).
2. **Navigate to Project Directory:**
   ```bash
   cd NPC_Evolve_Fhe
   ```
3. **Install Dependencies:**
   ```bash
   npm install
   ```

This command will fetch the required libraries, including Zama's FHE SDK, necessary for running the project. Remember, **do not use `git clone` for this setup**, as the project files should be downloaded directly.

## Compiling and Running the Project 🚀

After successfully installing the dependencies, you can compile and deploy your smart contracts by following these commands:

1. **Compile Contracts:**
   ```bash
   npx hardhat compile
   ```
2. **Deploy Contracts:**
   ```bash
   npx hardhat run scripts/deploy.js --network <your_network>
   ```
3. **Run Tests:**
   ```bash
   npx hardhat test
   ```

Here’s a sample of how you might interact with the deployed NPC Evolve contract in JavaScript:

```javascript
const { ethers } = require("hardhat");

async function main() {
    const NPC_Evolve = await ethers.getContractFactory("NPC_Evolve");
    const npcEvolve = await NPC_Evolve.deploy();

    console.log("NPC Evolve deployed to:", npcEvolve.address);
    
    // Example interaction
    const result = await npcEvolve.interactWithNPC(playerId, action);
    console.log("Interaction Result:", result);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

## Powered by Zama 🙏

We extend our heartfelt thanks to the incredible team at Zama for their pioneering work and development of open-source tools that empower the creation of confidential blockchain applications. Their contributions make it possible for NPC Evolve to offer a truly immersive and private gaming experience, where every player interaction helps shape a vibrant virtual world.

Embark on the journey of NPC Evolve today, and help evolve an autonomous world where your actions truly matter!
