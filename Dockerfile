FROM node:18

# Install Python, venv, and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set up virtual environment for Python
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Pillow in virtualenv
RUN pip install --no-cache-dir pillow

# Create working directory
WORKDIR /app

# Copy all project files
COPY . .

# Install Node dependencies
RUN npm install

# Start watcher
CMD ["npm", "start"]
