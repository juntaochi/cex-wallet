#!/bin/bash

# Function to kill all background processes on exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes of this script's process group
    pkill -P $$
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Anvil..."
./start_anvil.sh > logs/anvil.log 2>&1 &
PID_ANVIL=$!

echo "Starting Solana Test Validator..."
./start_solana_localnet.sh > logs/solana.log 2>&1 &
PID_SOLANA=$!

echo "Waiting 20s for infrastructure to start..."
sleep 20

echo "Starting DB Gateway..."
(cd db_gateway && npm run dev) > logs/db_gateway.log 2>&1 &
PID_DB=$!

echo "Starting Risk Control..."
(cd risk_control && npm run dev) > logs/risk_control.log 2>&1 &
PID_RISK=$!

echo "Starting Signer..."
(cd signer && echo "12345678" | npm run dev) > logs/signer.log 2>&1 &
PID_SIGNER=$!

echo "Starting Wallet..."
(cd wallet && npm run dev) > logs/wallet.log 2>&1 &
PID_WALLET=$!

echo "Starting EVM Scan..."
(cd scan/evm_scan && npm run dev) > logs/evm_scan.log 2>&1 &
PID_EVM_SCAN=$!

echo "Starting Solana Scan..."
(cd scan/solana_scan && npm run dev) > logs/solana_scan.log 2>&1 &
PID_SOLANA_SCAN=$!

echo "All services started. Logs are being written to *.log files in the root directory."
echo "Press Ctrl+C to stop all services."

# Wait for all background processes
wait $PID_ANVIL $PID_SOLANA $PID_DB $PID_RISK $PID_SIGNER $PID_WALLET $PID_EVM_SCAN $PID_SOLANA_SCAN