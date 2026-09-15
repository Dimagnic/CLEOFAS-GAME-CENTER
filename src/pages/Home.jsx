import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import StationsBoard from '../components/StationsBoard'
import Pricing from '../components/Pricing'
import Services from '../components/Services'
import Booking from '../components/Booking'
import Contact from '../components/Contact'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="circuit-divider" />
        <StationsBoard />
        <Pricing />
        <Services />
        <Booking />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
