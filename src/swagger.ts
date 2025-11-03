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
      OrderTotals: {
        type: 'object',
        properties: {
          subtotal: { type: 'number', example: 9 },
          discount: { type: 'number', example: 1 },
          tax: { type: 'number', example: 0.5 },
          grandTotal: { type: 'number', example: 8.5 },
        },
      },
      OrderTotalsAdjustments: {
        type: 'object',
        properties: {
          discount: { type: 'number', example: 1 },
          tax: { type: 'number', example: 0.5 },
        },
      },
      OrderPayment: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['cash', 'card', 'loyalty'] },
          amount: { type: 'number', example: 8.5 },
          txnId: { type: 'string', example: 'MOCK-665c2ba2d6f42e4a3c8f9942' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665c2ba2d6f42e4a3c8fa120' },
          orgId: { type: 'string', example: 'yago-coffee' },
          locationId: { type: 'string', example: 'store-1' },
          registerId: { type: 'string', example: 'reg-1' },
          cashierId: { type: 'string', example: 'cashier-23' },
          customerId: { type: 'string', example: 'customer-501' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          totals: { $ref: '#/components/schemas/OrderTotals' },
          payments: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderPayment' },
          },
          status: {
            type: 'string',
            enum: ['draft', 'paid', 'fiscalized', 'cancelled'],
            example: 'paid',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderCreateRequest: {
        type: 'object',
        required: ['orgId', 'locationId', 'registerId', 'cashierId', 'items'],
        properties: {
          orgId: { type: 'string', example: 'yago-coffee' },
          locationId: { type: 'string', example: 'store-1' },
          registerId: { type: 'string', example: 'reg-1' },
          cashierId: { type: 'string', example: 'cashier-23' },
          customerId: { type: 'string', example: 'customer-501' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemInput' },
          },
          totals: { $ref: '#/components/schemas/OrderTotalsAdjustments' },
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
          totals: { $ref: '#/components/schemas/OrderTotalsAdjustments' },
        },
      },
      OrderPaymentRequest: {
        type: 'object',
        required: ['method', 'amount'],
        properties: {
          method: { type: 'string', enum: ['cash', 'card', 'loyalty'], example: 'card' },
          amount: { type: 'number', example: 8.5 },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
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
              enum: ['draft', 'paid', 'fiscalized', 'cancelled'],
            },
            description: 'Filter orders by status',
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
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid filter parameters' },
        },
      },
      post: {
        summary: 'Create draft order',
        tags: ['Orders'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderCreateRequest' },
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
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
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
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier supplied' },
          '404': { description: 'Order not found' },
        },
      },
      delete: {
        summary: 'Cancel an order',
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
            description: 'Order cancelled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier or state' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/items': {
      put: {
        summary: 'Replace items in an order',
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
                    error: { type: 'null', example: null },
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
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid identifier or payment payload' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
          '409': { description: 'Order already paid or cancelled' },
        },
      },
    },
    '/api/orders/{id}/fiscalize': {
      post: {
        summary: 'Mark an order as fiscalized',
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
            description: 'Order fiscalized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Order' },
                    error: { type: 'null', example: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Order must be paid before fiscalization' },
          '403': { description: 'Forbidden — admin or cashier role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
  },
});
