import PageHeader from '../components/PageHeader.jsx'
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
  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Mga paparating na aktibidad ng organisasyon."
      />

      <EmptyState
        icon="◆"
        title="Wala pang naka-schedule na event"
        message="Kapag may naidagdag nang event, dito ito lalabas kasama ang petsa, lugar, at sino ang sumali."
      />
    </>
  )
}

export default Events
