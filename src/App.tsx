import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/styles/ThemeProvider'
import { AuthProvider } from '@/modules/auth/AuthContext'
import { router } from '@/routes'

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}
