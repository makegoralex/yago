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
  },
});
