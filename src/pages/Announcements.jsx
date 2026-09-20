import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Announcements() {
  const { role } = useAuth()
  const { can } = getRoleConfig(role)

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={
          can.create
            ? 'Maglabas ng balita at paalala sa mga miyembro.'
            : 'Pinakabagong balita at paalala mula sa organisasyon.'
        }
        action={can.create && <ActionButton>+ Magpaskil</ActionButton>}
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
