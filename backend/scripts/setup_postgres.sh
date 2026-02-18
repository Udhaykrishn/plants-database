#!/bin/bash
set -e

# Start PostgreSQL service if not running
echo "Starting PostgreSQL service..."
sudo service postgresql start || sudo systemctl start postgresql

# Create database and user
echo "Configuring Database..."
sudo -u postgres psql -c "CREATE DATABASE plants_db;" || echo "Database plants_db already exists (or creation failed)."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" || echo "Failed to set password for user postgres."

echo "Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE plants_db TO postgres;"

echo "Database setup complete."
echo "Connection String: postgresql://postgres:postgres@localhost:5432/plants_db"
