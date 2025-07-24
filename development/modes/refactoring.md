# REFACTORING Mode Instructions

You are in REFACTORING mode, focused on improving code structure without changing external behavior.

## Advanced Refactoring Patterns

### Strangler Fig Pattern
For gradually replacing legacy systems:

```javascript
// Legacy system wrapper
class LegacySystemAdapter {
    constructor(legacySystem, newSystem, featureFlags) {
        this.legacy = legacySystem;
        this.new = newSystem;
        this.flags = featureFlags;
    }
    
    async processOrder(order) {
        // Gradually migrate functionality
        if (this.flags.isEnabled('use-new-order-validation')) {
            order = await this.new.validateOrder(order);
        } else {
            order = await this.legacy.validateOrder(order);
        }
        
        if (this.flags.isEnabled('use-new-pricing-engine')) {
            order.pricing = await this.new.calculatePricing(order);
        } else {
            order.pricing = await this.legacy.calculatePricing(order);
        }
        
        // Eventually, all calls go to new system
        return order;
    }
}
```

### Branch by Abstraction
Safely refactor large systems in production:

```javascript
// Step 1: Create abstraction
interface DataStore {
    save(id: string, data: any): Promise<void>;
    load(id: string): Promise<any>;
    delete(id: string): Promise<void>;
}

// Step 2: Implement for existing system
class FileDataStore implements DataStore {
    async save(id: string, data: any) {
        await fs.writeFile(`${id}.json`, JSON.stringify(data));
    }
    // ... other methods
}

// Step 3: Create new implementation
class DatabaseDataStore implements DataStore {
    async save(id: string, data: any) {
        await db.collection('data').insertOne({ _id: id, ...data });
    }
    // ... other methods
}

// Step 4: Switch at runtime
const dataStore = process.env.USE_DATABASE === 'true' 
    ? new DatabaseDataStore() 
    : new FileDataStore();
```

### Parallel Change (Expand-Contract)
Evolve interfaces without breaking consumers:

```javascript
// Step 1: Expand - Add new method alongside old
class UserService {
    // Old method
    getUser(userId) {
        return this.getUserById({ id: userId });
    }
    
    // New method with better signature
    getUserById({ id, includeDeleted = false }) {
        const query = { id };
        if (!includeDeleted) {
            query.deletedAt = null;
        }
        return this.repository.findOne(query);
    }
}

// Step 2: Migrate callers to new method
// Step 3: Contract - Remove old method
```

### Refactoring Metrics

#### Complexity Analysis
```javascript
// Measure cyclomatic complexity
function calculateComplexity(ast) {
    let complexity = 1; // Base complexity
    
    traverse(ast, {
        IfStatement: () => complexity++,
        ConditionalExpression: () => complexity++,
        LogicalExpression: ({ node }) => {
            if (node.operator === '&&' || node.operator === '||') {
                complexity++;
            }
        },
        ForStatement: () => complexity++,
        WhileStatement: () => complexity++,
        CatchClause: () => complexity++,
        CaseStatement: () => complexity++
    });
    
    return complexity;
}

// Target: Keep functions below complexity 10
```

#### Coupling Metrics
```javascript
// Measure afferent/efferent coupling
class CouplingAnalyzer {
    analyze(modules) {
        const metrics = new Map();
        
        modules.forEach(module => {
            const imported = this.getImportedModules(module);
            const importedBy = this.getImportingModules(module, modules);
            
            metrics.set(module.name, {
                efferentCoupling: imported.length,  // Dependencies
                afferentCoupling: importedBy.length, // Dependents
                instability: imported.length / (imported.length + importedBy.length)
            });
        });
        
        return metrics;
    }
}
```

### Concurrent Code Refactoring

#### Lock-Free Data Structures
```javascript
// Before: Mutex-based counter
class Counter {
    constructor() {
        this.value = 0;
        this.mutex = new Mutex();
    }
    
    async increment() {
        await this.mutex.lock();
        try {
            this.value++;
        } finally {
            this.mutex.unlock();
        }
    }
}

// After: Atomic operations
class AtomicCounter {
    constructor() {
        this.buffer = new SharedArrayBuffer(4);
        this.value = new Int32Array(this.buffer);
    }
    
    increment() {
        Atomics.add(this.value, 0, 1);
    }
    
    get() {
        return Atomics.load(this.value, 0);
    }
}
```

#### Actor Model Refactoring
```javascript
// Refactor shared mutable state to actors
class UserActor {
    constructor(id) {
        this.id = id;
        this.state = { balance: 0 };
        this.mailbox = [];
    }
    
    send(message) {
        this.mailbox.push(message);
        this.processMessages();
    }
    
    async processMessages() {
        while (this.mailbox.length > 0) {
            const message = this.mailbox.shift();
            await this.handle(message);
        }
    }
    
    async handle(message) {
        switch (message.type) {
            case 'DEPOSIT':
                this.state.balance += message.amount;
                message.reply(this.state.balance);
                break;
            case 'WITHDRAW':
                if (this.state.balance >= message.amount) {
                    this.state.balance -= message.amount;
                    message.reply({ success: true, balance: this.state.balance });
                } else {
                    message.reply({ success: false, error: 'Insufficient funds' });
                }
                break;
        }
    }
}
```

### Database Refactoring Patterns

#### Introduce Surrogate Key
```sql
-- Step 1: Add new column
ALTER TABLE orders ADD COLUMN id SERIAL PRIMARY KEY;

-- Step 2: Update application to use new key
-- Step 3: Migrate foreign keys
ALTER TABLE order_items 
    ADD COLUMN order_id INTEGER REFERENCES orders(id);
    
UPDATE order_items oi
SET order_id = o.id
FROM orders o
WHERE oi.order_number = o.order_number;

-- Step 4: Drop old foreign key
ALTER TABLE order_items 
    DROP COLUMN order_number;
```

#### Split Table
```javascript
// Refactor wide table into focused tables
class TableSplitter {
    async splitUserTable() {
        // Step 1: Create new tables
        await db.query(`
            CREATE TABLE user_profiles (
                user_id INT PRIMARY KEY,
                bio TEXT,
                avatar_url VARCHAR(255),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        await db.query(`
            CREATE TABLE user_preferences (
                user_id INT PRIMARY KEY,
                theme VARCHAR(50),
                notifications BOOLEAN,
                language VARCHAR(10),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Step 2: Migrate data in batches
        const batchSize = 1000;
        let offset = 0;
        
        while (true) {
            const users = await db.query(
                'SELECT * FROM users LIMIT ? OFFSET ?',
                [batchSize, offset]
            );
            
            if (users.length === 0) break;
            
            // Insert into new tables
            await this.migrateProfiles(users);
            await this.migratePreferences(users);
            
            offset += batchSize;
        }
        
        // Step 3: Drop columns from original table
        await db.query(`
            ALTER TABLE users 
            DROP COLUMN bio,
            DROP COLUMN avatar_url,
            DROP COLUMN theme,
            DROP COLUMN notifications,
            DROP COLUMN language
        `);
    }
}
```

### API Evolution Without Breaking Changes

#### Versioned Response Transformation
```javascript
class APIVersionTransformer {
    transformResponse(data, version) {
        const transformers = {
            'v1': this.transformToV1,
            'v2': this.transformToV2,
            'v3': this.transformToV3
        };
        
        // Start with latest format
        let result = data;
        
        // Apply transformations backwards to target version
        const versions = Object.keys(transformers);
        const targetIndex = versions.indexOf(version);
        
        for (let i = versions.length - 1; i > targetIndex; i--) {
            result = transformers[versions[i]].call(this, result);
        }
        
        return result;
    }
    
    transformToV2(v3Data) {
        // Remove v3-specific fields
        const { newField, ...v2Data } = v3Data;
        
        // Rename fields for v2
        if (v3Data.updatedName) {
            v2Data.name = v3Data.updatedName;
            delete v2Data.updatedName;
        }
        
        return v2Data;
    }
}
```

### Refactoring Safety Checklist

Before starting any refactoring:
- [ ] Comprehensive tests exist for affected code
- [ ] Performance benchmarks captured
- [ ] Feature flags ready for gradual rollout
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

During refactoring:
- [ ] Each step maintains all tests passing
- [ ] Commits are atomic and revertible
- [ ] Performance metrics tracked
- [ ] No functional changes mixed in

After refactoring:
- [ ] All tests still pass
- [ ] Performance maintained or improved
- [ ] Code metrics show improvement
- [ ] Documentation updated
- [ ] Team code review completed

Remember: Refactoring is a disciplined approach to improving code. Make it better without making it different.