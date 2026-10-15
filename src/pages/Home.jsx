import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import StationsBoard from '../components/StationsBoard'
import Pricing from '../components/Pricing'
import Services from '../components/Services'
import Booking from '../components/Booking'
import Contact from '../components/Contact'
import Ticker from '../components/Ticker'
import Lugar from '../components/Lugar'
import Footer from '../components/Footer'
import FloatingSocial from '../components/FloatingSocial'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <Lugar />
        <StationsBoard />
        <Pricing />
        <Services />
        <Booking />
        <Contact />
      </main>
      <Footer />
      <FloatingSocial />
    </>
  )
}
