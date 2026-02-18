const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET todos los empleados
router.get('/', async (req, res) => {
  try {
    const { isActive, position } = req.query;
    
    let query = { userId: req.user._id };
    
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (position) query.position = position;
    
    const employees = await Employee.find(query).sort({ name: 1 });
    
    res.json({
      success: true,
      count: employees.length,
      employees
    });
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empleados'
    });
  }
});

// GET un empleado específico
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    res.json({
      success: true,
      employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener empleado'
    });
  }
});

// POST crear empleado
router.post('/', async (req, res) => {
  try {
    const employeeData = {
      ...req.body,
      userId: req.user._id
    };
    
    const employee = await Employee.create(employeeData);
    
    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente',
      employee
    });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear empleado',
      error: error.message
    });
  }
});

// PUT actualizar empleado
router.put('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'userId') {
        employee[key] = req.body[key];
      }
    });
    
    await employee.save();
    
    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente',
      employee
    });
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar empleado'
    });
  }
});

// DELETE desactivar empleado
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    employee.isActive = false;
    await employee.save();
    
    res.json({
      success: true,
      message: 'Empleado desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al desactivar empleado'
    });
  }
});

// PUT activar empleado
router.put('/:id/activate', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    employee.isActive = true;
    await employee.save();
    
    res.json({
      success: true,
      message: 'Empleado activado exitosamente',
      employee
    });
  } catch (error) {
    console.error('Error al activar empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al activar empleado'
    });
  }
});

module.exports = router;