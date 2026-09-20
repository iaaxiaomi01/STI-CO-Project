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

  /* Ang can.create at can.review ay nakatakda sa
     config/roles.js. Tatlong magkaibang itsura ang page
     na ito, pero iisa lang ang component:

       Officer → gumagawa    (may "+ Gumawa ng Event")
       Adviser → sumusuri    (walang button, ibang subtitle)
       Member  → tumitingin  (walang button)  */
  const { can } = getRoleConfig(role)

  let subtitle = 'Mga paparating na aktibidad ng organisasyon.'
  if (can.create) {
    subtitle = 'Gumawa at pamahalaan ang mga aktibidad ng organisasyon.'
  } else if (can.review) {
    subtitle = 'Suriin at aprubahan ang mga iminungkahing aktibidad.'
  }

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={subtitle}
        /* Ang gumagawa lang ang may button. Sa Adviser at
           Member, undefined ang action at walang lalabas. */
        action={can.create && <ActionButton>+ Gumawa ng Event</ActionButton>}
      />

      <EmptyState
        icon="◆"
        title="Wala pang naka-schedule na event"
        message={
          can.create
            ? 'Kapag gumawa ka ng event, dito ito lalabas kasama ang petsa, lugar, at sino ang sumali.'
            : 'Kapag may naidagdag nang event, dito ito lalabas kasama ang petsa, lugar, at sino ang sumali.'
        }
      />
    </>
  )
}

export default Events
