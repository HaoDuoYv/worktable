import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { OverviewPage } from '@/modules/overview/OverviewPage'
import { TutorialsPage } from '@/modules/tutorials/TutorialsPage'
import { TutorialPlayerPage } from '@/modules/tutorials/TutorialPlayerPage'
import { AlgorithmsLabPage } from '@/modules/algorithms/AlgorithmsLabPage'
import { AiPage } from '@/modules/ai/AiPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { LoginPage, RegisterPage, ForgotPasswordPage } from '@/modules/auth/AuthPages'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <OverviewPage />,
        handle: { title: '概览' },
      },
      {
        path: 'tutorials',
        element: <TutorialsPage />,
        handle: { title: '教程' },
      },
      {
        path: 'tutorials/:id',
        element: <TutorialPlayerPage />,
        handle: { title: '教程学习', flush: true },
      },
      {
        path: 'algorithms',
        element: <AlgorithmsLabPage />,
        handle: { title: '算法实验室', flush: true },
      },
      {
        path: 'ai',
        element: <AiPage />,
        handle: { title: 'AI', flush: true },
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        handle: { title: '设置' },
      },
    ],
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
    ],
  },
])
