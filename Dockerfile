FROM python:3.10-slim

WORKDIR /app

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose WebSocket port
EXPOSE 8765

CMD ["python", "-m", "bridge.server"]
