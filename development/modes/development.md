# DEVELOPMENT Mode Instructions

You are in DEVELOPMENT mode, focused on implementing new features with production-ready patterns.

## Advanced Development Patterns

### Feature Flag Implementation

#### Toggle Pattern
```javascript
// feature-flags.js
class FeatureFlags {
    constructor(config) {
        this.flags = config.flags || {};
        this.userOverrides = new Map();
    }
    
    isEnabled(flagName, userId = null) {
        // Check user-specific override first
        if (userId && this.userOverrides.has(`${flagName}:${userId}`)) {
            return this.userOverrides.get(`${flagName}:${userId}`);
        }
        
        const flag = this.flags[flagName];
        if (!flag) return false;
        
        // Percentage rollout
        if (flag.percentage && userId) {
            const hash = this.hashUserId(userId, flagName);
            return hash < flag.percentage;
        }
        
        return flag.enabled || false;
    }
    
    hashUserId(userId, salt) {
        // Consistent hash for gradual rollout
        let hash = 0;
        const str = `${userId}:${salt}`;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash) % 100;
    }
}

// Usage in code
if (featureFlags.isEnabled('new-checkout-flow', user.id)) {
    return renderNewCheckout();
} else {
    return renderLegacyCheckout();
}
```

### API Versioning Strategies

#### URL Versioning
```javascript
// routes/v1/users.js
router.get('/api/v1/users/:id', getUserV1);
router.get('/api/v2/users/:id', getUserV2);

// Deprecation headers
function getUserV1(req, res) {
    res.set('Sunset', 'Sat, 31 Dec 2024 23:59:59 GMT');
    res.set('Deprecation', 'true');
    res.set('Link', '</api/v2/users>; rel="successor-version"');
    // ... v1 logic
}
```

#### Header Versioning
```javascript
// middleware/api-version.js
function apiVersion(req, res, next) {
    const version = req.headers['api-version'] || 'v1';
    req.apiVersion = version;
    
    // Route to appropriate handler
    const handler = versionHandlers[req.path]?.[version];
    if (!handler) {
        return res.status(400).json({ 
            error: `API version ${version} not supported for this endpoint` 
        });
    }
    
    handler(req, res, next);
}
```

### Database Migration Patterns

#### Safe Migration Strategy
```javascript
// migrations/20240101_add_user_preferences.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Step 1: Add column with default
        await queryInterface.addColumn('users', 'preferences', {
            type: Sequelize.JSON,
            defaultValue: {},
            allowNull: false
        });
        
        // Step 2: Backfill existing records in batches
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
            const [updated] = await queryInterface.sequelize.query(`
                UPDATE users 
                SET preferences = '{"theme": "light", "notifications": true}'
                WHERE id IN (
                    SELECT id FROM users 
                    WHERE preferences = '{}'
                    LIMIT ${batchSize} OFFSET ${offset}
                )
            `);
            
            hasMore = updated > 0;
            offset += batchSize;
            
            // Prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    },
    
    down: async (queryInterface) => {
        // Ensure backward compatibility
        await queryInterface.removeColumn('users', 'preferences');
    }
};
```

### Dependency Injection Patterns

```javascript
// container.js
class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }
    
    register(name, factory, options = {}) {
        this.services.set(name, {
            factory,
            singleton: options.singleton || false
        });
    }
    
    get(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found`);
        }
        
        if (service.singleton) {
            if (!this.singletons.has(name)) {
                this.singletons.set(name, service.factory(this));
            }
            return this.singletons.get(name);
        }
        
        return service.factory(this);
    }
}

// Setup
const container = new DIContainer();
container.register('database', () => new Database(config.db), { singleton: true });
container.register('userRepository', (c) => new UserRepository(c.get('database')));
container.register('userService', (c) => new UserService(c.get('userRepository')));

// Usage
const userService = container.get('userService');
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
    constructor(asyncFunction, options = {}) {
        this.asyncFunction = asyncFunction;
        this.failureThreshold = options.failureThreshold || 5;
        this.cooldownPeriod = options.cooldownPeriod || 60000;
        this.requestTimeout = options.requestTimeout || 10000;
        
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttempt = Date.now();
    }
    
    async call(...args) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }
        
        try {
            const result = await this.timeout(this.asyncFunction(...args));
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    timeout(promise) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout)
            )
        ]);
    }
    
    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    
    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.cooldownPeriod;
        }
    }
}
```

### Event-Driven Architecture

```javascript
// Event Bus Implementation
class EventBus {
    constructor() {
        this.events = new Map();
        this.middlewares = [];
    }
    
    use(middleware) {
        this.middlewares.push(middleware);
    }
    
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);
    }
    
    async emit(event, data) {
        // Run middlewares
        for (const middleware of this.middlewares) {
            data = await middleware(event, data);
        }
        
        const handlers = this.events.get(event) || [];
        
        // Execute handlers concurrently
        await Promise.all(
            handlers.map(handler => 
                handler(data).catch(error => 
                    console.error(`Error in ${event} handler:`, error)
                )
            )
        );
    }
}

// Domain Events
const eventBus = new EventBus();

// Middleware for logging
eventBus.use(async (event, data) => {
    console.log(`Event: ${event}`, { timestamp: new Date(), data });
    return data;
});

// Subscribe to events
eventBus.on('user.created', async (user) => {
    await sendWelcomeEmail(user);
});

eventBus.on('user.created', async (user) => {
    await createInitialPreferences(user);
});

// Emit events
await eventBus.emit('user.created', newUser);
```

### Microservices Communication Patterns

#### Retry with Exponential Backoff
```javascript
async function callServiceWithRetry(serviceCall, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000;
    const maxDelay = options.maxDelay || 30000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await serviceCall();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            
            // Check if error is retryable
            if (!isRetryable(error)) throw error;
            
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                maxDelay
            );
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function isRetryable(error) {
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500);
}
```

### Development Mode Best Practices

#### Incremental Feature Development
1. **Start with a spike**: Proof of concept to validate approach
2. **Build the MVP**: Core functionality with basic error handling
3. **Add resilience**: Retries, circuit breakers, timeouts
4. **Implement monitoring**: Metrics, logs, traces
5. **Optimize performance**: Only after functionality is complete

#### Integration Strategies
- **Adapter Pattern**: Wrap external dependencies
- **Facade Pattern**: Simplify complex subsystems
- **Anti-Corruption Layer**: Protect from external changes

Remember: In development mode, focus on building robust, scalable features that can evolve with changing requirements.