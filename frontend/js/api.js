// Configuración de la API
const API_CONFIG = {
  baseURL: 'http://localhost:5000/api',
  timeout: 10000
};

// Cliente HTTP simple
class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ============ AUTH ============
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // ============ PRODUCTS ============
  async getProducts() {
    return this.request('/products');
  }

  async createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  async adjustStock(productId, adjustmentData) {
    return this.request(`/products/${productId}/adjust`, {
      method: 'POST',
      body: JSON.stringify(adjustmentData)
    });
  }

  async deactivateProduct(productId) {
    return this.request(`/products/${productId}/deactivate`, {
      method: 'PUT'
    });
  }

  async getProductHistory(productId) {
    const purchases = await this.request(`/purchases?productId=${productId}`);
    const sales     = await this.request(`/sales?productId=${productId}`);
    return {
      purchases: purchases.purchases || [],
      sales:     sales.sales || []
    };
  }

  // ============ PURCHASES ============
  async getPurchases(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/purchases?${params}`);
  }

  async createPurchase(purchaseData) {
    return this.request('/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData)
    });
  }

  async updatePurchase(id, purchaseData) {
    return this.request(`/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(purchaseData)
    });
  }

  async deletePurchase(id) {
    return this.request(`/purchases/${id}`, {
      method: 'DELETE'
    });
  }

  // ============ SALES ============
  async getSales(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/sales?${params}`);
  }

  async createSale(saleData) {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData)
    });
  }

  async updateSale(id, saleData) {
    return this.request(`/sales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(saleData)
    });
  }

  async deleteSale(id) {
    return this.request(`/sales/${id}`, {
      method: 'DELETE'
    });
  }

  // ============ STATS ============
  async getDashboard() {
    return this.request('/stats/dashboard');
  }

  async getProductStats() {
    return this.request('/stats/products');
  }

  // ============ TECHNICAL SERVICES ============
  async getTechnicalServices(url = '/technical-services') {
    return this.request(url);
  }

  async getTechnicalService(id) {
    return this.request(`/technical-services/${id}`);
  }

  async createTechnicalService(serviceData) {
    return this.request('/technical-services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  }

  async updateTechnicalService(id, serviceData) {
    return this.request(`/technical-services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData)
    });
  }

  async deleteTechnicalService(id) {
    return this.request(`/technical-services/${id}`, {
      method: 'DELETE'
    });
  }

  async updateServiceStatus(id, status) {
    return this.request(`/technical-services/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // ✅ NUEVO: Marcar equipo como entregado y aprobar comisión del técnico
  async deliverService(id) {
    return this.request(`/technical-services/${id}/deliver`, {
      method: 'PUT'
    });
  }

  async getServiceStats() {
    return this.request('/technical-services/stats/summary');
  }

  // ============ REPORTS ============
  async getReportSales(period, startDate, endDate) {
    const params = new URLSearchParams();
    if (period)    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate)   params.append('endDate', endDate);
    return this.request(`/reports/sales?${params}`);
  }

  async getReportSummary(period) {
    return this.request(`/reports/summary?period=${period}`);
  }

  // ============ EMPLOYEES ============
  async getEmployees(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/employees?${params}`);
  }

  async getEmployee(id) {
    return this.request(`/employees/${id}`);
  }

  async createEmployee(employeeData) {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  }

  async updateEmployee(id, employeeData) {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData)
    });
  }

  async deleteEmployee(id) {
    return this.request(`/employees/${id}`, {
      method: 'DELETE'
    });
  }

  async activateEmployee(id) {
    return this.request(`/employees/${id}/activate`, {
      method: 'PUT'
    });
  }

  // ============ COMMISSIONS ============
  async getCommissions(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/commissions?${params}`);
  }

  async getEmployeeMonthlyReport(employeeId, year, month) {
    const params = new URLSearchParams({ year, month });
    return this.request(`/commissions/employee/${employeeId}/monthly?${params}`);
  }

  async approveCommission(id) {
    return this.request(`/commissions/${id}/approve`, {
      method: 'PUT'
    });
  }

  async payCommission(id, notes = '') {
    return this.request(`/commissions/${id}/pay`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    });
  }

  async payCommissionsBatch(commissionIds, notes = '') {
    return this.request('/commissions/batch/pay', {
      method: 'PUT',
      body: JSON.stringify({ commissionIds, notes })
    });
  }
}

// Exportar instancia global
const api = new APIClient();