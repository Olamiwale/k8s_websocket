# WebSocket Kubernetes Project - Production Grade

A complete production-ready WebSocket chat system demonstrating advanced Kubernetes features including StatefulSets, HPA, session affinity, and zero-downtime scaling with 10k+ concurrent connections.

## 🎯 Project Goals

- **StatefulSets** for WebSocket server persistence
- **Session Affinity** to maintain persistent connections
- **Horizontal Pod Autoscaling** based on CPU/Memory metrics
- **Redis Pub/Sub** for cross-pod message broadcasting
- **MongoDB Replica Set** for message persistence
- **Zero-downtime scaling** during load tests
- **Load testing** with 10,000+ concurrent WebSocket connections

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Browsers                      │
└─────────────────┬───────────────────────────────────────┘
                  │ WebSocket (ws://)
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Kubernetes Service (NodePort)               │
│           Session Affinity: ClientIP                     │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┬─────────────┐
        ▼                   ▼             ▼
  ┌──────────┐        ┌──────────┐   ┌──────────┐
  │   WS-0   │        │   WS-1   │   │   WS-N   │
  │StatefulSet│       │StatefulSet│  │StatefulSet│
  └────┬─────┘        └────┬─────┘   └────┬─────┘
       │                   │              │
       └───────────────────┴──────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
      ┌──────────┐               ┌──────────┐
      │  Redis   │               │ MongoDB  │
      │ Pub/Sub  │               │ReplicaSet│
      └──────────┘               └──────────┘
```

## 📁 Project Structure

```
websocket-k8s/
├── README.md
├── deploy.sh                    # Automated deployment script
│
├── backend/
│   ├── server.js               # WebSocket server with Redis & MongoDB
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   └── App.jsx            # React chat UI
│   ├── package.json
│   └── Dockerfile
│
├── k8s/
│   ├── namespace.yaml          # websocket-system namespace
│   ├── mongodb-statefulset.yaml
│   ├── redis-deployment.yaml
│   ├── websocket-statefulset.yaml
│   ├── websocket-service.yaml  # With session affinity
│   └── websocket-hpa.yaml      # HPA configuration
│
└── load-test/
    ├── test.js                 # Load testing script
    └── package.json
```

## 🚀 Quick Start

### Prerequisites

```bash
# Required tools
- Docker
- Minikube
- kubectl
- Node.js 18+

# Start Minikube with sufficient resources
minikube start --cpus=4 --memory=8192 --driver=docker

# Enable required addons
minikube addons enable metrics-server
minikube addons enable ingress
```

### 1. Automated Deployment

```bash
# Make the script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Build Docker images
- ✅ Create namespace
- ✅ Deploy MongoDB replica set
- ✅ Deploy Redis
- ✅ Deploy WebSocket servers
- ✅ Configure HPA
- ✅ Print access information

### 2. Manual Deployment (Alternative)

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy infrastructure
kubectl apply -f k8s/mongodb-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n websocket-system --timeout=300s

# Build backend image
cd backend
eval $(minikube docker-env)
docker build -t websocket-server:latest .
cd ..

# Deploy WebSocket servers
kubectl apply -f k8s/websocket-statefulset.yaml
kubectl apply -f k8s/websocket-service.yaml

# Configure HPA
kubectl apply -f k8s/websocket-hpa.yaml

# Wait for WebSocket pods
kubectl wait --for=condition=ready pod -l app=websocket-server -n websocket-system --timeout=180s
```

### 3. Access the Application

```bash
# Get Minikube IP
minikube ip

# WebSocket endpoint
ws://<MINIKUBE_IP>:30080

# Or use port forwarding
kubectl port-forward svc/websocket-external 8080:8080 -n websocket-system
# Then connect to: ws://localhost:8080
```

## 🧪 Load Testing

### Install Dependencies

```bash
cd load-test
npm install
```

### Run Load Test (10k connections)

```bash
# Basic test
WS_URL=ws://$(minikube ip):30080 node test.js

# Custom configuration
WS_URL=ws://$(minikube ip):30080 \
CONNECTIONS=10000 \
RAMP_UP=60 \
DURATION=300 \
MSG_INTERVAL=10000 \
node test.js
```

### Load Test Parameters

- `CONNECTIONS`: Total number of concurrent connections (default: 10000)
- `RAMP_UP`: Time to establish all connections in seconds (default: 60)
- `DURATION`: How long to hold the load in seconds (default: 300)
- `MSG_INTERVAL`: Time between messages per connection in ms (default: 10000)

### Expected Results

```
📊 LOAD TEST STATISTICS (300s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connections:
  • Connected:     10000
  • Disconnected:  0
  • Active:        10000
  • Errors:        0
  • Reconnects:    0

Messages:
  • Sent:          300000
  • Received:      300000
  • Rate:          1000 msg/s

Pod Distribution:
  • websocket-server-0: 5000 connections
  • websocket-server-1: 5000 connections
  • websocket-server-2: 3500 connections (scaled up)
```

## 📊 Monitoring & Observability

### Watch Auto-Scaling in Real-Time

```bash
# Terminal 1: Watch HPA status
kubectl get hpa -n websocket-system -w

# Terminal 2: Watch pod scaling
kubectl get pods -n websocket-system -w

# Terminal 3: Monitor pod metrics
watch kubectl top pods -n websocket-system
```

### View Logs

```bash
# Stream logs from all WebSocket pods
kubectl logs -f -l app=websocket-server -n websocket-system

# View specific pod logs
kubectl logs -f websocket-server-0 -n websocket-system

# Last 100 lines
kubectl logs --tail=100 -l app=websocket-server -n websocket-system
```

### Check Pod Distribution

```bash
# Get detailed pod info
kubectl get pods -n websocket-system -o wide

# Check endpoints
kubectl get endpoints -n websocket-system

# Describe HPA
kubectl describe hpa websocket-hpa -n websocket-system
```

### MongoDB Status

```bash
# Check replica set status
kubectl exec -it mongodb-0 -n websocket-system -- mongosh --eval "rs.status()"

# View stored messages
kubectl exec -it mongodb-0 -n websocket-system -- mongosh chat --eval "db.messages.find().limit(10)"
```

### Redis Operations

```bash
# Check Redis connection
kubectl exec -it $(kubectl get pod -l app=redis -n websocket-system -o jsonpath='{.items[0].metadata.name}') -n websocket-system -- redis-cli ping

# Monitor pub/sub
kubectl exec -it $(kubectl get pod -l app=redis -n websocket-system -o jsonpath='{.items[0].metadata.name}') -n websocket-system -- redis-cli MONITOR
```

## 🎓 Key Kubernetes Features Demonstrated

### 1. StatefulSets

**Why StatefulSets?**
- Stable, unique network identifiers
- Stable, persistent storage
- Ordered, graceful deployment and scaling
- Ordered, automated rolling updates

**Implementation:**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: websocket-server
spec:
  serviceName: websocket-service
  replicas: 2
```

### 2. Session Affinity (Sticky Sessions)

**Why Session Affinity?**
- Maintains persistent WebSocket connections
- Prevents connection drops during load balancing
- Routes same client to same pod

**Implementation:**
```yaml
apiVersion: v1
kind: Service
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 hours
```

### 3. Horizontal Pod Autoscaler (HPA)

**Scaling Triggers:**
- CPU utilization > 70%
- Memory utilization > 80%

**Scaling Behavior:**
- Scale up: Add 50% or 2 pods every 30s
- Scale down: Remove 25% or 1 pod every 60s
- Min replicas: 2
- Max replicas: 10

**Implementation:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        averageUtilization: 70
```

### 4. Graceful Shutdown

**Zero-Downtime Features:**
- 30-second termination grace period
- PreStop lifecycle hooks
- SIGTERM handling in application
- Connection draining before pod termination

**Implementation:**
```javascript
// In server.js
process.on('SIGTERM', () => {
  console.log('SIGTERM received, starting graceful shutdown...');
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  // 10-second grace period for active connections
  setTimeout(() => process.exit(0), 10000);
});
```

### 5. Redis Pub/Sub Architecture

**Purpose:**
- Enables message broadcasting across multiple pods
- Decouples WebSocket servers
- Scales horizontally without state synchronization issues

**How it works:**
1. Client sends message to Pod A
2. Pod A publishes to Redis channel
3. All pods (A, B, C) subscribe to the channel
4. All pods broadcast to their connected clients

## 🧹 Cleanup

```bash
# Delete entire namespace (removes everything)
kubectl delete namespace websocket-system

# Or delete resources individually
kubectl delete -f k8s/websocket-hpa.yaml
kubectl delete -f k8s/websocket-service.yaml
kubectl delete -f k8s/websocket-statefulset.yaml
kubectl delete -f k8s/redis-deployment.yaml
kubectl delete -f k8s/mongodb-statefulset.yaml
kubectl delete -f k8s/namespace.yaml

# Stop Minikube
minikube stop

# Delete Minikube cluster
minikube delete
```

## 🐛 Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods -n websocket-system

# Describe pod for events
kubectl describe pod websocket-server-0 -n websocket-system

# Check logs
kubectl logs websocket-server-0 -n websocket-system
```

### MongoDB connection issues

```bash
# Check if MongoDB replica set is initialized
kubectl exec -it mongodb-0 -n websocket-system -- mongosh --eval "rs.status()"

# Reinitialize if needed
kubectl exec -it mongodb-0 -n websocket-system -- mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongodb-0.mongodb-service:27017' },
    { _id: 1, host: 'mongodb-1.mongodb-service:27017' }
  ]
})
"
```

### HPA not scaling

```bash
# Check metrics server
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# Check HPA status
kubectl describe hpa websocket-hpa -n websocket-system

# Verify metrics
kubectl top pods -n websocket-system
```

### WebSocket connection refused

```bash
# Check service
kubectl get svc websocket-external -n websocket-system

# Verify port
kubectl get svc websocket-external -n websocket-system -o jsonpath='{.spec.ports[0].nodePort}'

# Test connectivity
curl http://$(minikube ip):30080/health
```

## 📚 Learning Resources

- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Service Session Affinity](https://kubernetes.io/docs/concepts/services-networking/service/#session-stickiness)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)

## 🎯 Next Steps

1. **Add Prometheus monitoring**
   - Custom metrics for connection count
   - Grafana dashboards
   
2. **Implement custom metrics for HPA**
   - Scale based on active WebSocket connections
   - Use Prometheus adapter

3. **Add TLS/SSL support**
   - Secure WebSocket connections (wss://)
   - Cert-manager integration

4. **Deploy to production cluster**
   - Use managed Kubernetes (EKS, GKE, AKS)
   - Configure ingress controller
   - Set up external DNS

5. **Add CI/CD pipeline**
   - GitHub Actions
   - Automated testing
   - Blue-green deployments

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for learning Kubernetes at scale**# k8s_websocket
