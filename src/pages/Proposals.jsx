import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'

/* Dating "Requests" ito — pinalitan ng pangalan bilang
   "Proposals". Wala ito sa sidebar ng Member, at wala rin
   siyang route para dito — Officer at Adviser lang ang
   nakakakita, dahil pareho silang may can.review.

   PALITAN: placeholder pa ito. Tingnan ang Announcements.jsx
   para sa hugis ng pagkuha ng totoong data mula sa Supabase.

   Walang ActionButton dito sa ngayon. Ang bawat row ay
   magkakaroon ng sariling "Aprubahan" at "Tanggihan" kapag
   may data na.

   Kung magkaiba pala ang NAKIKITANG proposal ng Officer at ng
   Adviser, doon mo sila paghihiwalayin — sa query ng data,
   hindi sa itsura ng page. */
function Proposals() {
  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Mga proposal na naghihintay ng iyong aksyon."
      />

      <EmptyState
        icon="✉"
        title="Walang naghihintay na proposal"
        message="Kapag may nagpasa ng proposal, dito ito lalabas kasama ang petsa, sino ang nagpasa, at ang mga button para aprubahan o tanggihan."
      />
    </>
  )
}

export default Proposals
