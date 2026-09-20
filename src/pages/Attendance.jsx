import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Attendance() {
  const { role } = useAuth()
  const { can } = getRoleConfig(role)

  /* Malaki ang pinagkaiba dito:
       Member  — SARILI niyang record lang
       Officer — siya ang kumukuha ng attendance
       Adviser — tinitingnan ang pagdalo ng LAHAT  */
  let subtitle = 'Talaan ng iyong pagdalo sa mga aktibidad.'
  if (can.create) {
    subtitle = 'Kumuha at suriin ang pagdalo sa mga aktibidad.'
  } else if (can.review) {
    subtitle = 'Tingnan ang pagdalo ng buong organisasyon.'
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={subtitle}
        action={can.create && <ActionButton>+ Kumuha ng Attendance</ActionButton>}
      />

      <EmptyState
        icon="✓"
        title="Wala pang attendance record"
        message={
          can.review
            ? 'Kapag may natapos nang event, dito lalabas ang talaan ng dumalo at hindi dumalo.'
            : 'Kapag nakadalo ka na sa isang event, dito lalabas ang talaan — anong event, kailan, at kung present o absent ka.'
        }
      />
    </>
  )
}

export default Attendance
