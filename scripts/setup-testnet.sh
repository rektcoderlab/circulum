#!/bin/bash

# Circulum Testnet Setup Script
# This script sets up the Docker environment and Solana testnet integration

set -e

echo "🚀 Setting up Circulum Testnet Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Generate test keypairs if they don't exist
generate_keypairs() {
    print_status "Setting up Solana keypairs..."
    
    # Create keys directory if it doesn't exist
    mkdir -p keys
    
    # Check if solana CLI is available in the system
    if command -v solana-keygen &> /dev/null; then
        if [ ! -f "keys/test-keypair.json" ]; then
            print_status "Generating test keypair..."
            solana-keygen new --no-bip39-passphrase --silent --outfile keys/test-keypair.json
            print_success "Test keypair generated"
        else
            print_warning "Test keypair already exists"
        fi
        
        if [ ! -f "keys/program-keypair.json" ]; then
            print_status "Generating program keypair..."
            solana-keygen new --no-bip39-passphrase --silent --outfile keys/program-keypair.json
            print_success "Program keypair generated"
        else
            print_warning "Program keypair already exists"
        fi
    else
        print_warning "Solana CLI not found locally. Keypairs will be generated in Docker container."
    fi
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."
    
    # Copy testnet environment to .env if it doesn't exist
    if [ ! -f ".env" ]; then
        cp .env.testnet .env
        print_success "Environment file created from testnet template"
    else
        print_warning "Environment file already exists"
    fi
    
    # Copy API environment file
    if [ ! -f "api/.env" ]; then
        cp api/.env.example api/.env
        print_success "API environment file created"
    else
        print_warning "API environment file already exists"
    fi
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build Solana development image
    print_status "Building Solana development image..."
    docker build -f Dockerfile.solana -t circulum-solana:latest .
    
    # Build API image
    print_status "Building API image..."
    docker build -f api/Dockerfile -t circulum-api:latest ./api
    
    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start core services (MongoDB, Solana dev environment, API)
    docker-compose up -d mongodb solana-dev api
    
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are healthy
    if docker-compose ps | grep -q "Up"; then
        print_success "Services started successfully"
    else
        print_error "Some services failed to start"
        docker-compose logs
        exit 1
    fi
}

# Setup Solana testnet configuration
setup_solana_config() {
    print_status "Configuring Solana for testnet..."
    
    # Run Solana configuration inside the container
    docker-compose exec solana-dev bash -c "
        solana config set --url https://api.testnet.solana.com
        solana config set --keypair /workspace/keys/test-keypair.json
        echo 'Solana configuration:'
        solana config get
    "
    
    print_success "Solana testnet configuration completed"
}

# Request testnet SOL airdrop
request_airdrop() {
    print_status "Requesting testnet SOL airdrop..."
    
    docker-compose exec solana-dev bash -c "
        echo 'Current balance:'
        solana balance
        echo 'Requesting airdrop...'
        solana airdrop 2
        echo 'New balance:'
        solana balance
    "
    
    print_success "Airdrop completed"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Run the test suite
    docker-compose --profile testing run --rm test-runner
    
    if [ $? -eq 0 ]; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed. Check the output above."
    fi
}

# Display status
show_status() {
    print_status "Environment Status:"
    echo ""
    echo "Services:"
    docker-compose ps
    echo ""
    echo "Access URLs:"
    echo "  - API: http://localhost:3000"
    echo "  - MongoDB: mongodb://admin:password123@localhost:27017/circulum"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Stop services: docker-compose down"
    echo "  - Run tests: docker-compose --profile testing run --rm test-runner"
    echo "  - Access Solana container: docker-compose exec solana-dev bash"
    echo ""
}

# Main execution
main() {
    echo "🔧 Circulum Testnet Setup"
    echo "========================="
    
    check_docker
    check_docker_compose
    generate_keypairs
    setup_env_files
    build_images
    start_services
    setup_solana_config
    request_airdrop
    
    print_success "Setup completed successfully!"
    echo ""
    
    show_status
    
    # Ask if user wants to run tests
    read -p "Do you want to run the test suite? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_tests
    fi
    
    print_success "Circulum testnet environment is ready! 🎉"
}

# Run main function
main "$@"
