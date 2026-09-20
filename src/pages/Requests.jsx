import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* Wala ito sa sidebar ng Member, at wala rin siyang route
   para dito — Officer at Adviser lang ang nakakakita, dahil
   pareho silang may can.review.

   PALITAN: placeholder pa ito. Tingnan ang Events.jsx para
   sa hugis ng pagkuha ng totoong data mula sa Supabase.

   Walang ActionButton dito, at sinadya iyon: ang mga request
   ay HINDI ginagawa sa page na ito — dito sila inaaksyunan.
   Ang bawat row ay magkakaroon ng sariling "Aprubahan" at
   "Tanggihan" kapag may data na.

   Kung magkaiba pala ang NAKIKITANG request ng Officer at ng
   Adviser, doon mo sila paghihiwalayin — sa query ng data,
   hindi sa itsura ng page. */
function Requests() {
  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Mga kahilingang naghihintay ng iyong aksyon."
      />

      <EmptyState
        icon="✉"
        title="Walang naghihintay na request"
        message="Kapag may nagpadala ng kahilingan, dito ito lalabas kasama ang petsa, sino ang nagpadala, at ang mga button para aprubahan o tanggihan."
      />
    </>
  )
}

export default Requests
