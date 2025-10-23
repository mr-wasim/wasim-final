// pages/_app.js
import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import RequireLocation from '../components/RequireLocation'

export default function MyApp({ Component, pageProps }){
  return (
    <RequireLocation>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </RequireLocation>
  )
}
