import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase. */
function Attendance() {
  const { role } = useAuth()
  const { canManage } = getRoleConfig(role)

  return (
    <>
      <PageHeader
        title="Attendance"
        /* Malaki ang pinagkaiba dito: ang Member ay tumitingin
           ng SARILI niyang record. Ang Officer ay kumukuha ng
           attendance ng LAHAT. */
        subtitle={
          canManage
            ? 'Kumuha at suriin ang pagdalo sa mga aktibidad.'
            : 'Talaan ng iyong pagdalo sa mga aktibidad.'
        }
        action={canManage && <ActionButton>+ Kumuha ng Attendance</ActionButton>}
      />

      <EmptyState
        icon="✓"
        title="Wala pang attendance record"
        message={
          canManage
            ? 'Kapag may natapos nang event, dito lalabas ang talaan ng dumalo at hindi dumalo.'
            : 'Kapag nakadalo ka na sa isang event, dito lalabas ang talaan — anong event, kailan, at kung present o absent ka.'
        }
      />
    </>
  )
}

export default Attendance
