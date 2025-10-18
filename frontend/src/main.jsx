
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import AddCar from './pages/AddCar'
import CarDetails from './pages/CarDetails'
import ScanPayment from './pages/ScanPayment'
import Booking from './pages/Booking'
import History from './pages/History'
import Transactions from './pages/Transactions'

function App(){
  const token = localStorage.getItem('token')
  return (
    <BrowserRouter>
      <Routes>
  <Route path="/login" element={<Login/>} />
  <Route path="/register" element={<Register/>} />
  <Route path="/admin-login" element={<AdminLogin/>} />
        <Route path="/booking" element={ token ? <Booking/> : <Navigate to="/login" />} />
  <Route path="/history" element={ token ? <History/> : <Navigate to="/login" />} />
  <Route path="/transactions" element={ token ? <Transactions/> : <Navigate to="/login" />} />
        <Route path="/dashboard" element={ token ? <Dashboard/> : <Navigate to="/login" />} />
        <Route path="/add-car" element={ token ? <AddCar/> : <Navigate to="/login" />} />
        <Route path="/car/:id" element={ token ? <CarDetails/> : <Navigate to="/login" />} />
        <Route path="/scan" element={ token ? <ScanPayment/> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/register" />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
