# Solana development environment with Anchor
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV RUST_VERSION=1.75.0
ENV SOLANA_VERSION=1.17.15
ENV ANCHOR_VERSION=0.29.0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libudev-dev \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/v${SOLANA_VERSION}/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor CLI
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
RUN avm install ${ANCHOR_VERSION}
RUN avm use ${ANCHOR_VERSION}

# Set working directory
WORKDIR /workspace

# Create solana config directory
RUN mkdir -p /root/.config/solana

# Copy project files
COPY . .

# Install npm dependencies
RUN npm install

# Install API dependencies
RUN cd api && npm install

# Install CLI dependencies
RUN cd cli && npm install

# Generate a new keypair for testing (will be overridden by volume mount in production)
RUN solana-keygen new --no-bip39-passphrase --silent --outfile /root/.config/solana/id.json

# Configure Solana for testnet
RUN solana config set --url https://api.testnet.solana.com

# Expose ports
EXPOSE 3000 8899

# Default command
CMD ["bash"]
