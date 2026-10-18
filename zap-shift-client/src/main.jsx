import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router'
import { router } from './router/router.jsx'
import 'aos/dist/aos.js'
import Aos from 'aos'
import AuthProvider from './contexts/AuthContext/AuthProvider.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
//React Leaflet, Stripe, Tanstack Query
const queryClient = new QueryClient()

Aos.init({
  duration: 1000,
  once: true,
  offset: 100,
  easing: 'ease-in-out'
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className='font-urbanist max-w-7xl mx-auto'>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router}>
          </RouterProvider>
        </AuthProvider>
      </QueryClientProvider>
    </div>
  </StrictMode>,
)
