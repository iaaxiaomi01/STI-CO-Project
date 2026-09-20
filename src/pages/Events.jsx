import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import PageHeader from '../components/PageHeader.jsx'
import ActionButton from '../components/ActionButton.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* PALITAN: placeholder pa ito.

   Kapag may database ka na, ganito ang magiging hugis:
     1. const [events, setEvents] = useState([])
     2. useEffect na kukuha sa Supabase:
          const { data } = await supabase.from('events').select('*')
     3. events.length === 0  →  ipakita ang <EmptyState />
        may laman           →  i-map ang events sa mga card

   Huwag burahin ang EmptyState kapag totoo na ang data —
   kakailanganin mo pa rin ito kapag walang naka-schedule. */
function Events() {
  const { role } = useAuth()

  /* Ang canManage ay nakatakda sa config/roles.js.
     Officer: true. Member: false.

     Ito ang nagpapaiba ng page na ito sa dalawang role —
     iisang component, dalawang itsura. */
  const { canManage } = getRoleConfig(role)

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={
          canManage
            ? 'Gumawa at pamahalaan ang mga aktibidad ng organisasyon.'
            : 'Mga paparating na aktibidad ng organisasyon.'
        }
        /* Officer lang ang may button. Sa Member, undefined
           ang action at walang lalabas. */
        action={canManage && <ActionButton>+ Gumawa ng Event</ActionButton>}
      />

      <EmptyState
        icon="◆"
        title="Wala pang naka-schedule na event"
        message={
          canManage
            ? 'Kapag gumawa ka ng event, dito ito lalabas kasama ang petsa, lugar, at sino ang sumali.'
            : 'Kapag may naidagdag nang event, dito ito lalabas kasama ang petsa, lugar, at sino ang sumali.'
        }
      />
    </>
  )
}

export default Events
