function getDefaultApiBaseURL() {
  const hostname = window.location.hostname || '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname);
  const isLocalFile = window.location.protocol === 'file:';

  if (isLocalHost || isLocalFile) {
    return 'http://localhost:5000/api';
  }

  return 'https://vendly-jash.onrender.com/api';
}

// Configuración de la API
const API_CONFIG = {
  baseURL: getDefaultApiBaseURL(),
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

  async getProductUnits(productId, status = 'available') {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return this.request(`/products/${productId}/units?${params.toString()}`);
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

  // ============ EXPENSES ============
  async getExpenses(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/expenses?${params}`);
  }

  async createExpense(expenseData) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  async updateExpense(id, expenseData) {
    return this.request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  }

  async deleteExpense(id) {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE'
    });
  }

  // ============ COMPATIBILITY ============
  async getCompatibilityMeta() {
    return this.request('/compatibility/meta');
  }

  async getCompatibilityBrands() {
    return this.request('/compatibility/brands');
  }

  async getCompatibilityModels(brand = '') {
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    return this.request(`/compatibility/models?${params}`);
  }

  async getCompatibilitySubtypes() {
    return this.request('/compatibility/subtypes');
  }

  async getCompatibilitySpecs(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/compatibility/specs?${params}`);
  }

  async getCompatibilityGroups(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/compatibility/groups?${params}`);
  }

  async getCompatibilityCatalog(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/compatibility/catalog?${params}`);
  }

  async getCompatibilityDevice(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/compatibility/device?${params}`);
  }

  async searchCompatibility(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/compatibility/search?${params}`);
  }

  async getCompatibilityPurchaseSuggestions(query, limit = 18) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request(`/compatibility/purchase-suggestions?${params}`);
  }

  async createCompatibilityCatalogItem(data) {
    return this.request('/compatibility/admin/catalog', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCompatibilityCatalogItem(id, data) {
    return this.request(`/compatibility/admin/catalog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCompatibilityCatalogItem(id) {
    return this.request(`/compatibility/admin/catalog/${id}`, {
      method: 'DELETE'
    });
  }

  async createCompatibilityGroup(data) {
    return this.request('/compatibility/admin/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCompatibilityGroup(id, data) {
    return this.request(`/compatibility/admin/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCompatibilityGroup(id) {
    return this.request(`/compatibility/admin/groups/${id}`, {
      method: 'DELETE'
    });
  }

  async createCompatibilitySpec(data) {
    return this.request('/compatibility/admin/specs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCompatibilitySpec(id, data) {
    return this.request(`/compatibility/admin/specs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCompatibilitySpec(id) {
    return this.request(`/compatibility/admin/specs/${id}`, {
      method: 'DELETE'
    });
  }

  async importCompatibilityData(data) {
    return this.request('/compatibility/admin/import', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCompatibilityAuditLog(limit = 100) {
    return this.request(`/compatibility/admin/audit?limit=${encodeURIComponent(limit)}`);
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
