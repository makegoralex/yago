import type { OpenAPIV3 } from 'openapi-types';

export const buildSwaggerDocument = (): OpenAPIV3.Document => ({
  openapi: '3.0.0',
  info: {
    title: 'Yago POS API',
    version: '0.2.0',
    description: 'Authentication and RBAC module for Yago Coffee POS backend.',
  },
  servers: [
    {
      url: 'http://localhost:{port}',
      description: 'Local development server',
      variables: {
        port: {
          default: '3000',
        },
      },
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          name: { type: 'string', example: 'Alex Barista' },
          email: { type: 'string', example: 'alex@yago.coffee' },
          role: { type: 'string', enum: ['admin', 'manager', 'barista'] },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
          role: { type: 'string', enum: ['admin', 'manager', 'barista'] },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      CatalogCategory: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          name: { type: 'string', example: 'Espresso' },
          sortOrder: { type: 'integer', example: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CatalogCategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Espresso' },
          sortOrder: { type: 'integer', example: 1 },
        },
      },
      CatalogCategoryUpdateInput: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Espresso' },
          sortOrder: { type: 'integer', example: 1 },
        },
      },
      CatalogProduct: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8f9942' },
          name: { type: 'string', example: 'Flat White' },
          categoryId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          price: { type: 'number', example: 4.5 },
          modifiers: {
            type: 'array',
            items: { type: 'string', example: 'Oat Milk' },
          },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CatalogProductInput: {
        type: 'object',
        required: ['name', 'categoryId', 'price'],
        properties: {
          name: { type: 'string', example: 'Flat White' },
          categoryId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          price: { type: 'number', example: 4.5 },
          modifiers: {
            type: 'array',
            items: { type: 'string', example: 'Oat Milk' },
          },
          isActive: { type: 'boolean', example: true },
        },
      },
      CatalogProductUpdateInput: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Flat White' },
          categoryId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          price: { type: 'number', example: 4.5 },
          modifiers: {
            type: 'array',
            items: { type: 'string', example: 'Oat Milk' },
          },
          isActive: { type: 'boolean', example: true },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9942' },
          name: { type: 'string', example: 'Flat White' },
          qty: { type: 'number', example: 2 },
          price: { type: 'number', example: 4.5 },
          modifiersApplied: {
            type: 'array',
            items: { type: 'string', example: 'Extra shot' },
          },
          total: { type: 'number', example: 9 },
        },
      },
      OrderItemInput: {
        type: 'object',
        required: ['productId', 'qty'],
        properties: {
          productId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9942' },
          name: { type: 'string', example: 'Flat White w/ oat milk' },
          qty: { type: 'number', example: 1 },
          price: { type: 'number', example: 4.5 },
          modifiersApplied: {
            type: 'array',
            items: { type: 'string', example: 'Oat Milk' },
          },
        },
      },
      OrderPayment: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['cash', 'card'] },
          amount: { type: 'number', example: 520 },
          change: { type: 'number', example: 30 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8fa120' },
          orgId: { type: 'string', example: 'yago-coffee' },
          locationId: { type: 'string', example: 'store-1' },
          registerId: { type: 'string', example: 'reg-1' },
          cashierId: { type: 'string', example: '665c2ba2d6f42e4a3c8fa300' },
          customerId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9900' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          subtotal: { type: 'number', example: 490 },
          discount: { type: 'number', example: 40 },
          total: { type: 'number', example: 450 },
          payment: { $ref: '#/components/schemas/OrderPayment' },
          status: {
            type: 'string',
            enum: ['draft', 'paid', 'completed'],
            example: 'completed',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderStartRequest: {
        type: 'object',
        required: ['orgId', 'locationId', 'registerId'],
        properties: {
          orgId: { type: 'string', example: 'yago-coffee' },
          locationId: { type: 'string', example: 'store-1' },
          registerId: { type: 'string', example: 'main-register' },
          customerId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9900' },
        },
      },
      OrderItemsUpdateRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemInput' },
          },
          discount: { type: 'number', example: 40 },
          customerId: {
            type: 'string',
            nullable: true,
            example: '665c2ba2d6f42e4a3c8f9900',
            description: 'Attach or replace customer on the order. Set null to detach.',
          },
        },
      },
      OrderPaymentRequest: {
        type: 'object',
        required: ['method', 'amount'],
        properties: {
          method: { type: 'string', enum: ['cash', 'card'], example: 'card' },
          amount: { type: 'number', example: 500 },
          change: { type: 'number', example: 50 },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8fb321' },
          name: { type: 'string', example: 'Jane Patron' },
          phone: { type: 'string', example: '+15551234567' },
          email: { type: 'string', example: 'jane@yago.coffee' },
          points: { type: 'number', example: 125.5 },
          totalSpent: { type: 'number', example: 512.25 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CustomerInput: {
        type: 'object',
        required: ['name', 'phone'],
        properties: {
          name: { type: 'string', example: 'Jane Patron' },
          phone: { type: 'string', example: '+15551234567' },
          email: { type: 'string', example: 'jane@yago.coffee' },
        },
      },
      LoyaltyEarnRequest: {
        type: 'object',
        required: ['customerId', 'orderId', 'amount'],
        properties: {
          customerId: { type: 'string', example: '665c2ba2d6f42e4a3c8fb321' },
          orderId: { type: 'string', example: '665c2ba2d6f42e4a3c8fa120' },
          amount: { type: 'number', example: 24.5 },
        },
      },
      LoyaltyRedeemRequest: {
        type: 'object',
        required: ['customerId', 'points'],
        properties: {
          customerId: { type: 'string', example: '665c2ba2d6f42e4a3c8fb321' },
          points: { type: 'number', example: 100 },
        },
      },
      ReportsSummary: {
        type: 'object',
        properties: {
          totalOrders: { type: 'integer', example: 128 },
          totalRevenue: { type: 'number', example: 2350.75 },
          avgCheck: { type: 'number', example: 18.36 },
          totalCustomers: { type: 'integer', example: 82 },
          totalPointsIssued: { type: 'number', example: 415.2 },
          totalPointsRedeemed: { type: 'number', example: 120.5 },
        },
      },
      ReportsDailyEntry: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2024-06-15' },
          totalRevenue: { type: 'number', example: 325.5 },
          orderCount: { type: 'integer', example: 27 },
        },
      },
      ReportsTopProduct: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: '665c2ba2d6f42e4a3c8f9921' },
          name: { type: 'string', example: 'Flat White' },
          totalQuantity: { type: 'integer', example: 154 },
          totalRevenue: { type: 'number', example: 924.5 },
        },
      },
      ReportsTopCustomer: {
        type: 'object',
        properties: {
          customerId: { type: 'string', example: '665c2ba2d6f42e4a3c8fb321' },
          name: { type: 'string', example: 'Jane Patron' },
          phone: { type: 'string', example: '+15551234567' },
          email: { type: 'string', example: 'jane@yago.coffee' },
          totalSpent: { type: 'number', example: 752.6 },
          pointsBalance: { type: 'number', example: 45.3 },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        summary: 'Root availability check',
        responses: {
          '200': {
            description: 'Root route response',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: '✅ Yago POS API is running',
                },
              },
            },
          },
        },
      },
    },
    '/healthz': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    tokens: { $ref: '#/components/schemas/AuthTokens' },
                  },
                },
              },
            },
          },
          '409': {
            description: 'User already exists',
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate a user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    tokens: { $ref: '#/components/schemas/AuthTokens' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens refreshed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tokens: { $ref: '#/components/schemas/AuthTokens' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid refresh token',
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/protected': {
      get: {
        summary: 'Protected example endpoint',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Access granted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '403': {
            description: 'Forbidden',
          },
        },
      },
    },
    '/api/catalog/categories': {
      get: {
        summary: 'List catalog categories',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Catalog categories retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CatalogCategory' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a catalog category',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CatalogCategoryInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Category created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CatalogCategory' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
    },
    '/api/catalog/categories/{id}': {
      put: {
        summary: 'Update a catalog category',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CatalogCategoryUpdateInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Category updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CatalogCategory' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid identifier or payload',
          },
          '404': {
            description: 'Category not found',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
      delete: {
        summary: 'Delete a catalog category',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Category deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid identifier',
          },
          '404': {
            description: 'Category not found',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
    },
    '/api/catalog/products': {
      get: {
        summary: 'List catalog products',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter products by category identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Catalog products retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CatalogProduct' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid query parameters',
          },
        },
      },
      post: {
        summary: 'Create a catalog product',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CatalogProductInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CatalogProduct' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
    },
    '/api/catalog/products/{id}': {
      put: {
        summary: 'Update a catalog product',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CatalogProductUpdateInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CatalogProduct' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid identifier or payload',
          },
          '404': {
            description: 'Product not found',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
      delete: {
        summary: 'Delete a catalog product',
        tags: ['Catalog'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Product deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid identifier',
          },
          '404': {
            description: 'Product not found',
          },
          '403': {
            description: 'Forbidden — admin role required',
          },
        },
      },
    },
    '/api/orders': {
      get: {
        summary: 'List orders',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['draft', 'paid', 'completed'],
            },
            description: 'Filter orders by status',
          },
          {
            name: 'cashierId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter by cashier identifier (admin only)',
          },
          {
            name: 'registerId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter by register identifier',
          },
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Return orders created after this ISO date',
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Return orders created before this ISO date',
          },
        ],
        responses: {
          '200': {
            description: 'Orders retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid filter parameters' },
        },
      },
    },
    '/api/orders/start': {
      post: {
        summary: 'Start a new draft order',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderStartRequest' },
              examples: {
                start: {
                  summary: 'Create order at register #1',
                  value: {
                    orgId: 'yago-coffee',
                    locationId: 'moscow-hq',
                    registerId: 'front-bar',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Customer not found' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        summary: 'Get order by id',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Order retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier supplied' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/items': {
      post: {
        summary: 'Add or update items in an order',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderItemsUpdateRequest' },
              examples: {
                update: {
                  summary: 'Update order items',
                  value: {
                    items: [
                      { productId: '665c2ba2d6f42e4a3c8f9942', qty: 2 },
                      { productId: '665c2ba2d6f42e4a3c8f9951', qty: 1 },
                    ],
                    discount: 40,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier or payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/pay': {
      post: {
        summary: 'Record payment for an order',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderPaymentRequest' },
              examples: {
                cash: {
                  summary: 'Cash payment',
                  value: { method: 'cash', amount: 500, change: 50 },
                },
                card: {
                  summary: 'Card payment',
                  value: { method: 'card', amount: 450 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order paid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier or payment payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
          '409': { description: 'Order already paid or completed' },
        },
      },
    },
    '/api/orders/{id}/complete': {
      post: {
        summary: 'Complete a paid order',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Order completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Order must be paid before completion' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/active': {
      get: {
        summary: 'List active orders for the current cashier',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'registerId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter by register identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Active orders retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden — admin or cashier role required' },
        },
      },
    },
    '/api/orders/today': {
      get: {
        summary: 'Orders created today',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'cashierId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Admin-only filter for a specific cashier',
          },
        ],
        responses: {
          '200': {
            description: 'Orders for the current day',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid filter parameters' },
          '403': { description: 'Forbidden — admin or cashier role required' },
        },
      },
    },
    '/api/customers': {
      get: {
        summary: 'List customers',
        tags: ['Customers'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Customers retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Customer' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden — admin or cashier role required' },
        },
      },
      post: {
        summary: 'Create a customer',
        tags: ['Customers'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CustomerInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Customer created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Customer' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '409': { description: 'Customer with phone already exists' },
        },
      },
    },
    '/api/customers/search': {
      get: {
        summary: 'Find customer by phone',
        tags: ['Customers'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'phone',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Phone number to search',
          },
        ],
        responses: {
          '200': {
            description: 'Customer found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Customer' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing phone parameter' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Customer not found' },
        },
      },
    },
    '/api/loyalty/earn': {
      post: {
        summary: 'Award loyalty points',
        tags: ['Loyalty'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoyaltyEarnRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Points awarded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        customer: { $ref: '#/components/schemas/Customer' },
                        pointsEarned: { type: 'number', example: 1.25 },
                      },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/loyalty/redeem': {
      post: {
        summary: 'Redeem loyalty points',
        tags: ['Loyalty'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoyaltyRedeemRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Points redeemed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        customer: { $ref: '#/components/schemas/Customer' },
                        pointsRedeemed: { type: 'number', example: 10 },
                      },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payload or insufficient points' },
          '403': { description: 'Forbidden — admin or cashier role required' },
        },
      },
    },
    '/api/reports/summary': {
      get: {
        summary: 'Get aggregated business metrics',
        tags: ['Reports'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Summary metrics calculated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/ReportsSummary' },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden — admin role required' },
        },
      },
    },
    '/api/reports/daily': {
      get: {
        summary: 'Get daily revenue breakdown',
        tags: ['Reports'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: { type: 'string', example: '2024-06-01' },
            description: 'Start date (inclusive) in YYYY-MM-DD format',
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: { type: 'string', example: '2024-06-30' },
            description: 'End date (inclusive) in YYYY-MM-DD format',
          },
        ],
        responses: {
          '200': {
            description: 'Daily metrics generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ReportsDailyEntry' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid date range' },
          '403': { description: 'Forbidden — admin role required' },
        },
      },
    },
    '/api/reports/top-products': {
      get: {
        summary: 'Get top selling products',
        tags: ['Reports'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', example: 5 },
            description: 'Number of products to return',
          },
        ],
        responses: {
          '200': {
            description: 'Top products calculated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ReportsTopProduct' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid limit parameter' },
          '403': { description: 'Forbidden — admin role required' },
        },
      },
    },
    '/api/reports/top-customers': {
      get: {
        summary: 'Get top customers by spending',
        tags: ['Reports'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', example: 5 },
            description: 'Number of customers to return',
          },
        ],
        responses: {
          '200': {
            description: 'Top customers calculated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ReportsTopCustomer' },
                    },
                    error: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid limit parameter' },
          '403': { description: 'Forbidden — admin role required' },
        },
      },
    },
  },
});
