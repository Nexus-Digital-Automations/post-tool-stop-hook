# TESTING Mode Instructions

You are in TESTING mode, focused on comprehensive test coverage and advanced testing strategies.

## Advanced Testing Patterns

### Chaos Engineering

#### Fault Injection Testing
```javascript
class ChaosMonkey {
    constructor(config) {
        this.failureRate = config.failureRate || 0.1;
        this.latencyMs = config.latencyMs || 5000;
        this.scenarios = config.scenarios || ['latency', 'error', 'timeout'];
    }
    
    async wrapService(service) {
        return new Proxy(service, {
            get: (target, prop) => {
                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }
                
                return async (...args) => {
                    // Randomly inject failures
                    if (Math.random() < this.failureRate) {
                        const scenario = this.randomScenario();
                        await this.injectFailure(scenario);
                    }
                    
                    return target[prop](...args);
                };
            }
        });
    }
    
    async injectFailure(scenario) {
        switch (scenario) {
            case 'latency':
                await new Promise(resolve => setTimeout(resolve, this.latencyMs));
                break;
            case 'error':
                throw new Error('Chaos: Service temporarily unavailable');
            case 'timeout':
                await new Promise(resolve => setTimeout(resolve, 30000));
                throw new Error('Chaos: Request timeout');
            case 'partial':
                // Return incomplete data
                throw new Error('Chaos: Partial response');
        }
    }
}

// Use in tests
describe('Order Service Resilience', () => {
    it('should handle payment service failures gracefully', async () => {
        const chaosPaymentService = await new ChaosMonkey({
            failureRate: 0.5,
            scenarios: ['error', 'timeout']
        }).wrapService(paymentService);
        
        const orderService = new OrderService(chaosPaymentService);
        
        // Test 100 orders, expect graceful degradation
        const results = await Promise.allSettled(
            Array(100).fill(null).map(() => 
                orderService.processOrder(generateOrder())
            )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(30); // Some should succeed
        
        const failed = results.filter(r => r.status === 'rejected');
        failed.forEach(result => {
            expect(result.reason).toMatch(/Payment processing failed|Retry later/);
        });
    });
});
```

### Security Testing Patterns

#### SQL Injection Testing
```javascript
const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users--",
    "' OR 1=1--",
    "admin'--",
    "') OR ('1'='1'--"
];

describe('SQL Injection Prevention', () => {
    sqlInjectionPayloads.forEach(payload => {
        it(`should safely handle payload: ${payload}`, async () => {
            const response = await request(app)
                .post('/api/login')
                .send({ 
                    username: payload, 
                    password: payload 
                });
            
            expect(response.status).toBe(401);
            expect(response.body).not.toContain('SQL');
            expect(response.body).not.toContain('syntax');
            
            // Verify database wasn't affected
            const userCount = await db.query('SELECT COUNT(*) FROM users');
            expect(userCount).toBeGreaterThan(0);
        });
    });
});
```

#### XSS Prevention Testing
```javascript
const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<<SCRIPT>alert("XSS");//<</SCRIPT>'
];

describe('XSS Prevention', () => {
    xssPayloads.forEach(payload => {
        it(`should sanitize payload: ${payload.substring(0, 20)}...`, async () => {
            const response = await request(app)
                .post('/api/comments')
                .send({ content: payload });
            
            expect(response.status).toBe(201);
            
            // Fetch the comment
            const comment = await request(app)
                .get(`/api/comments/${response.body.id}`);
            
            // Verify script tags are escaped/removed
            expect(comment.body.content).not.toContain('<script>');
            expect(comment.body.content).not.toContain('javascript:');
            expect(comment.body.content).not.toContain('onerror=');
        });
    });
});
```

#### Authentication Testing
```javascript
describe('Authentication Security', () => {
    describe('Brute Force Protection', () => {
        it('should lock account after failed attempts', async () => {
            const username = 'testuser@example.com';
            
            // Make 5 failed login attempts
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/login')
                    .send({ username, password: 'wrongpassword' });
            }
            
            // 6th attempt should be blocked
            const response = await request(app)
                .post('/api/login')
                .send({ username, password: 'correctpassword' });
            
            expect(response.status).toBe(429);
            expect(response.body.error).toContain('locked');
            expect(response.body.retryAfter).toBeGreaterThan(0);
        });
    });
    
    describe('Session Security', () => {
        it('should invalidate session on password change', async () => {
            const session = await loginUser();
            
            // Change password
            await request(app)
                .post('/api/change-password')
                .set('Authorization', `Bearer ${session.token}`)
                .send({ 
                    oldPassword: 'old',
                    newPassword: 'new'
                });
            
            // Old session should be invalid
            const response = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${session.token}`);
            
            expect(response.status).toBe(401);
        });
    });
});
```

### Load and Performance Testing

#### Stress Testing Pattern
```javascript
class StressTest {
    constructor(config) {
        this.concurrent = config.concurrent || 100;
        this.duration = config.duration || 60000;
        this.rampUp = config.rampUp || 10000;
    }
    
    async run(testFunction) {
        const results = {
            successful: 0,
            failed: 0,
            latencies: [],
            errors: []
        };
        
        const startTime = Date.now();
        const workers = [];
        
        // Ramp up workers
        for (let i = 0; i < this.concurrent; i++) {
            await new Promise(resolve => 
                setTimeout(resolve, this.rampUp / this.concurrent)
            );
            
            workers.push(this.worker(testFunction, results, startTime));
        }
        
        await Promise.all(workers);
        
        return {
            ...results,
            avgLatency: results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length,
            p95Latency: this.percentile(results.latencies, 0.95),
            p99Latency: this.percentile(results.latencies, 0.99),
            successRate: results.successful / (results.successful + results.failed)
        };
    }
    
    async worker(testFunction, results, startTime) {
        while (Date.now() - startTime < this.duration) {
            const start = Date.now();
            
            try {
                await testFunction();
                results.successful++;
                results.latencies.push(Date.now() - start);
            } catch (error) {
                results.failed++;
                results.errors.push(error.message);
            }
        }
    }
    
    percentile(arr, p) {
        const sorted = arr.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index];
    }
}

// Usage
describe('Load Testing', () => {
    it('should handle 100 concurrent users', async () => {
        const stress = new StressTest({
            concurrent: 100,
            duration: 30000,
            rampUp: 5000
        });
        
        const results = await stress.run(async () => {
            await request(app)
                .get('/api/products')
                .expect(200);
        });
        
        expect(results.successRate).toBeGreaterThan(0.99);
        expect(results.p95Latency).toBeLessThan(1000);
        expect(results.p99Latency).toBeLessThan(2000);
    });
});
```

### Visual Regression Testing

```javascript
class VisualRegressionTest {
    constructor(config) {
        this.threshold = config.threshold || 0.01; // 1% difference allowed
        this.baselineDir = config.baselineDir || './visual-baselines';
    }
    
    async compareScreenshots(testName, actualImage) {
        const baselinePath = path.join(this.baselineDir, `${testName}.png`);
        
        if (!fs.existsSync(baselinePath)) {
            // First run - save as baseline
            await actualImage.write(baselinePath);
            return { match: true, firstRun: true };
        }
        
        const baseline = await Jimp.read(baselinePath);
        const diff = Jimp.diff(baseline, actualImage);
        
        if (diff.percent > this.threshold) {
            // Save diff image for debugging
            await diff.image.write(`./visual-diffs/${testName}-diff.png`);
            await actualImage.write(`./visual-diffs/${testName}-actual.png`);
            
            return {
                match: false,
                difference: diff.percent,
                diffPath: `./visual-diffs/${testName}-diff.png`
            };
        }
        
        return { match: true, difference: diff.percent };
    }
}

describe('Visual Regression', () => {
    const visualTest = new VisualRegressionTest({ threshold: 0.02 });
    
    it('should match homepage appearance', async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        await page.goto('http://localhost:3000');
        await page.waitForSelector('.content-loaded');
        
        const screenshot = await page.screenshot();
        const image = await Jimp.read(screenshot);
        
        const result = await visualTest.compareScreenshots('homepage', image);
        
        expect(result.match).toBe(true);
        if (!result.match) {
            console.log(`Visual difference: ${result.difference * 100}%`);
            console.log(`Diff saved to: ${result.diffPath}`);
        }
        
        await browser.close();
    });
});
```

### Database Testing Strategies

#### Transaction Rollback Testing
```javascript
describe('Database Transactions', () => {
    it('should rollback on failure', async () => {
        const initialCount = await db.query('SELECT COUNT(*) FROM orders');
        
        try {
            await db.transaction(async (trx) => {
                // Insert order
                const order = await trx('orders').insert({
                    user_id: 1,
                    total: 100
                }).returning('*');
                
                // Insert order items
                await trx('order_items').insert({
                    order_id: order[0].id,
                    product_id: 999, // Non-existent product
                    quantity: 1
                });
                
                // This should fail due to foreign key constraint
            });
        } catch (error) {
            // Expected to fail
        }
        
        const finalCount = await db.query('SELECT COUNT(*) FROM orders');
        expect(finalCount).toEqual(initialCount);
    });
});
```

#### Migration Testing
```javascript
describe('Database Migrations', () => {
    it('should be reversible', async () => {
        const migrations = await getMigrationFiles();
        
        for (const migration of migrations) {
            // Take snapshot
            const snapshot = await db.snapshot();
            
            // Run up migration
            await migration.up(db);
            
            // Verify changes
            const upSchema = await db.getSchema();
            
            // Run down migration
            await migration.down(db);
            
            // Verify rollback
            const downSchema = await db.getSchema();
            expect(downSchema).toEqual(snapshot.schema);
        }
    });
});
```

### Contract Testing

```javascript
class ContractTest {
    constructor(provider, consumer) {
        this.provider = provider;
        this.consumer = consumer;
    }
    
    async verifyContract(contract) {
        // Provider verification
        describe(`${this.provider} meets contract`, () => {
            contract.interactions.forEach(interaction => {
                it(interaction.description, async () => {
                    const response = await request(this.provider)
                        [interaction.request.method.toLowerCase()](interaction.request.path)
                        .send(interaction.request.body);
                    
                    expect(response.status).toBe(interaction.response.status);
                    expect(response.body).toMatchSchema(interaction.response.schema);
                });
            });
        });
        
        // Consumer verification
        describe(`${this.consumer} follows contract`, () => {
            contract.interactions.forEach(interaction => {
                it(`correctly calls ${interaction.description}`, async () => {
                    const mock = nock(this.provider)
                        [interaction.request.method.toLowerCase()](interaction.request.path)
                        .reply(interaction.response.status, interaction.response.body);
                    
                    await this.consumer.executeScenario(interaction.scenario);
                    
                    expect(mock.isDone()).toBe(true);
                });
            });
        });
    }
}
```

### Test Environment Management

```javascript
class TestEnvironment {
    async setup() {
        // Start test containers
        this.postgres = await new PostgreSQLContainer()
            .withDatabase('test')
            .start();
        
        this.redis = await new GenericContainer('redis')
            .withExposedPorts(6379)
            .start();
        
        // Run migrations
        await this.runMigrations();
        
        // Seed test data
        await this.seedTestData();
        
        return {
            database: this.postgres.getConnectionString(),
            cache: `redis://${this.redis.getHost()}:${this.redis.getMappedPort(6379)}`
        };
    }
    
    async teardown() {
        await this.postgres.stop();
        await this.redis.stop();
    }
}
```

### Flaky Test Detection

```javascript
class FlakyTestDetector {
    async detectFlaky(testSuite, runs = 10) {
        const results = new Map();
        
        for (let i = 0; i < runs; i++) {
            const runResults = await this.runTests(testSuite);
            
            runResults.forEach(test => {
                if (!results.has(test.name)) {
                    results.set(test.name, []);
                }
                results.get(test.name).push(test.passed);
            });
        }
        
        const flakyTests = [];
        results.forEach((outcomes, testName) => {
            const failures = outcomes.filter(passed => !passed).length;
            if (failures > 0 && failures < runs) {
                flakyTests.push({
                    name: testName,
                    failureRate: failures / runs
                });
            }
        });
        
        return flakyTests;
    }
}
```

Remember: In testing mode, think beyond basic coverage. Build resilient systems through comprehensive testing strategies.