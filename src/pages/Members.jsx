import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* Wala ito sa sidebar ng Member, at wala rin siyang route
   para dito — Officer at Adviser lang ang nakakakita.

   PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Members() {
  const { role } = useAuth()
  const { can } = getRoleConfig(role)

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={
          can.create
            ? 'Pamahalaan ang listahan ng mga miyembro.'
            : 'Listahan ng mga miyembro ng organisasyon.'
        }
        /* Ang Officer ang nagdadagdag ng miyembro.
           Ang Adviser ay tumitingin lang. */
        action={
          can.create && <ActionButton>+ Magdagdag ng Miyembro</ActionButton>
        }
      />

      <EmptyState
        icon="▲"
        title="Wala pang nakatalang miyembro"
        message="Dito lalabas ang lahat ng miyembro kasama ang kanilang antas, kurso, at petsa ng pagsali."
      />
    </>
  )
}

export default Members
