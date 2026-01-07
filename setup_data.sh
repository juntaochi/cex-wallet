#!/bin/bash
echo "Deploying ERC20 Tokens..."
(cd wallet && npm run deploy:erc20:tokens)

echo "Deploying Solana Tokens..."
(cd wallet && npm run deploy:solana:tokens)

echo "Initializing Mock Data..."
(cd wallet && npm run mock:init)

echo "Data setup complete."