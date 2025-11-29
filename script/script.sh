#my script for web socket
echo 'starting......'

set -e


NAMESPACE="websocket-system"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"

echo -e "Creating websocket k8s project...."


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="websocket-system"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  WebSocket K8s Deployment Script         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}\n"

# Function to print section headers
print_header() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}✗ $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $1 found${NC}"
}

# Function to wait for pods
wait_for_pods() {
    local label=$1
    local count=$2
    local timeout=${3:-300}
    
    echo -e "${YELLOW}⏳ Waiting for $count pods with label $label to be ready...${NC}"
    
    kubectl wait --for=condition=ready pod \
        -l $label \
        -n $NAMESPACE \
        --timeout=${timeout}s
    
    echo -e "${GREEN}✓ Pods are ready!${NC}"
}

# Check prerequisites
print_header "CHECKING PREREQUISITES"
check_command kubectl
check_command docker
check_command minikube


if ! minikube status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Minikube is not running. Starting...${NC}"
    minikube start
else
    echo -e "${GREEN}✓ Minikube is running${NC}"
fi




# Enable required addons
print_header "ENABLING MINIKUBE ADDONS"
minikube addons enable metrics-server
minikube addons enable ingress
echo -e "${GREEN}✓ Addons enabled${NC}"





print_header "BUILDING DOCKER IMAGES"

echo -e "${BLUE}Building backend image...${NC}"

echo "current directory....."
cd ..
pwd

cd backend
echo 'installing dependencies....'
npm init -y
npm install express ws ioredis mongoose

eval $(minikube docker-env)
docker build -t websocket-server:latest .
echo -e "${GREEN}✓ Backend image built${NC}"


echo 'applying manifest in k8 folder.....'
pwd
cd ..


# Create namespace
print_header "CREATING NAMESPACE"
kubectl apply -f k8s/namespace.yaml
echo -e "${GREEN}✓ Namespace created${NC}"

# Deploy MongoDB
print_header "DEPLOYING MONGODB"
kubectl apply -f k8s/mongodb-statefulset.yaml
wait_for_pods "app=mongodb" 2 300
echo -e "${YELLOW}Initializing MongoDB replica set...${NC}"
sleep 15
echo -e "${GREEN}✓ MongoDB deployed${NC}"

# Deploy Redis
print_header "DEPLOYING REDIS"
kubectl apply -f k8s/redis-deployment.yaml
wait_for_pods "app=redis" 1 120
echo -e "${GREEN}✓ Redis deployed${NC}"

# Deploy WebSocket servers
print_header "DEPLOYING WEBSOCKET SERVERS"
kubectl apply -f k8s/websocket-statefulset.yaml
kubectl apply -f k8s/websocket-service.yaml
wait_for_pods "app=websocket-server" 2 180
echo -e "${GREEN}✓ WebSocket servers deployed${NC}"

