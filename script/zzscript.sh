#!/bin/bash

set -e

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

# Check if Minikube is running
if ! minikube status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Minikube is not running. Starting...${NC}"
    minikube start --cpus=4 --memory=8192 --driver=docker
else
    echo -e "${GREEN}✓ Minikube is running${NC}"
fi

# Enable required addons
print_header "ENABLING MINIKUBE ADDONS"
minikube addons enable metrics-server
minikube addons enable ingress
echo -e "${GREEN}✓ Addons enabled${NC}"

# Build Docker images
print_header "BUILDING DOCKER IMAGES"

echo -e "${BLUE}Building backend image...${NC}"
cd backend
eval $(minikube docker-env)
docker build -t websocket-server:latest .
echo -e "${GREEN}✓ Backend image built${NC}"

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

# Deploy HPA
print_header "CONFIGURING HPA"
kubectl apply -f k8s/websocket-hpa.yaml
echo -e "${GREEN}✓ HPA configured${NC}"

# Print access information
print_header "DEPLOYMENT COMPLETE!"

MINIKUBE_IP=$(minikube ip)
WS_PORT=30080

echo -e "${GREEN}✅ All services are running!${NC}\n"
echo -e "${BLUE}Access Information:${NC}"
echo -e "  • WebSocket URL: ${GREEN}ws://${MINIKUBE_IP}:${WS_PORT}${NC}"
echo -e "  • Minikube IP:   ${GREEN}${MINIKUBE_IP}${NC}"
echo -e ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  • View pods:           ${YELLOW}kubectl get pods -n ${NAMESPACE}${NC}"
echo -e "  • View services:       ${YELLOW}kubectl get svc -n ${NAMESPACE}${NC}"
echo -e "  • View HPA:            ${YELLOW}kubectl get hpa -n ${NAMESPACE}${NC}"
echo -e "  • Stream logs:         ${YELLOW}kubectl logs -f -l app=websocket-server -n ${NAMESPACE}${NC}"
echo -e "  • Port forward:        ${YELLOW}kubectl port-forward svc/websocket-external 8080:8080 -n ${NAMESPACE}${NC}"
echo -e ""
echo -e "${BLUE}Load Testing:${NC}"
echo -e "  • Run test:            ${YELLOW}cd load-test && node test.js${NC}"
echo -e "  • With custom params:  ${YELLOW}CONNECTIONS=5000 DURATION=180 node test.js${NC}"
echo -e ""
echo -e "${BLUE}Monitoring:${NC}"
echo -e "  • Watch pods scale:    ${YELLOW}kubectl get pods -n ${NAMESPACE} -w${NC}"
echo -e "  • Watch HPA:           ${YELLOW}kubectl get hpa -n ${NAMESPACE} -w${NC}"
echo -e "  • Top pods:            ${YELLOW}kubectl top pods -n ${NAMESPACE}${NC}"
echo -e ""

# Print pod status
print_header "CURRENT POD STATUS"
kubectl get pods -n $NAMESPACE -o wide

echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Ready to test! 🚀                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}\n"