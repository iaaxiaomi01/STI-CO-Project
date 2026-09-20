import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* Officer lang ang nakakakita ng page na ito — wala ito sa
   sidebar ng Member, at wala rin siyang route para dito.

   PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Members() {
  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Listahan ng mga miyembro ng organisasyon."
        action={<ActionButton>+ Magdagdag ng Miyembro</ActionButton>}
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
