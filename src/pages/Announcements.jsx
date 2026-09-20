import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Announcements() {
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Pinakabagong balita at paalala mula sa organisasyon."
      />

      <EmptyState
        icon="★"
        title="Wala pang announcement"
        message="Dito lalabas ang mga bagong paskil — pinakabago sa itaas, kasama ang petsa at kung sino ang nagpaskil."
      />
    </>
  )
}

export default Announcements
