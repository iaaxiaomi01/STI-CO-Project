import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Attendance() {
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Talaan ng iyong pagdalo sa mga aktibidad."
      />

      <EmptyState
        icon="✓"
        title="Wala pang attendance record"
        message="Kapag nakadalo ka na sa isang event, dito lalabas ang talaan — anong event, kailan, at kung present o absent ka."
      />
    </>
  )
}

export default Attendance
