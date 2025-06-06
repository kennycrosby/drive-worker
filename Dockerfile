FROM node:18

# Install Python and required libraries
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Pillow for Python
RUN pip3 install pillow

# Create working directory
WORKDIR /app

# Copy all project files
COPY . .

# Install Node dependencies
RUN npm install

# Start watcher
CMD ["npm", "start"]
