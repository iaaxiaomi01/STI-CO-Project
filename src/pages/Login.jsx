import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Login.module.css'

function Login() {
  /* CONTROLLED FORM:
     Ang React ang may hawak ng laman ng bawat input, hindi ang
     browser. Kaya isang useState lang para sa buong form —
     object na may email at password. */
  const [form, setForm] = useState({ email: '', password: '' })

  // Mga error message kada field. Walang laman = walang error.
  const [errors, setErrors] = useState({})

  // Nakikita ba ang password o naka-dots?
  const [showPassword, setShowPassword] = useState(false)

  // Naipasa ba nang matagumpay ang form?
  const [submitted, setSubmitted] = useState(false)

  /* Isang handler lang para sa LAHAT ng input.
     Gumagana ito dahil ang "name" attribute ng bawat input ay
     katugma ng key sa form state. */
  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({ ...prev, [name]: value }))

    // Alisin agad ang error habang nagta-type — mas magandang UX
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setSubmitted(false)
  }

  /* Validation. Ibinabalik ang object ng mga error.
     Kung walang laman ang object, ibig sabihin valid ang form. */
  function validate() {
    const found = {}

    if (!form.email.trim()) {
      found.email = 'Kailangan ang email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      found.email = 'Mukhang mali ang format ng email.'
    }

    if (!form.password) {
      found.password = 'Kailangan ang password.'
    } else if (form.password.length < 8) {
      found.password = 'Dapat 8 characters pataas ang password.'
    }

    return found
  }

  function handleSubmit(event) {
    // Pinipigilan nito ang default na page reload ng HTML forms
    event.preventDefault()

    const found = validate()
    setErrors(found)

    // May error? Huwag ituloy.
    if (Object.keys(found).length > 0) return

    /* TODO: dito ilalagay ang totoong login request kapag may
       backend ka na, halimbawa:
       const res = await fetch('/api/login', { ... })

       Sa ngayon, frontend lang ito — walang totoong
       authentication na nangyayari. */
    setSubmitted(true)
  }

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>
            Mag-sign in para ipagpatuloy ang iyong account.
          </p>
        </div>

        {/* noValidate: pinapatay ang built-in na validation ng browser
            para tayo ang may kontrol sa mga error message */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              placeholder="ikaw@halimbawa.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            {/* Lalabas lang ang error kapag may laman ang errors.email */}
            {errors.email && <p className={styles.errorText}>{errors.email}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>

            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                /* Dito nagpapalit ang type: "text" kapag nakikita,
                   "password" kapag nakatago */
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Itago ang password' : 'Ipakita ang password'}
              >
                {showPassword ? 'Itago' : 'Ipakita'}
              </button>
            </div>

            {errors.password && (
              <p className={styles.errorText}>{errors.password}</p>
            )}
          </div>

          <div className={styles.formRow}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" name="remember" />
              <span>Remember me</span>
            </label>

            {/* PALITAN: gawan ng totoong page kapag kailangan na */}
            <a href="/#contact" className={styles.smallLink}>
              Forgot password?
            </a>
          </div>

          <button type="submit" className={styles.submit}>
            Sign in
          </button>

          {/* Pansamantalang mensahe — palitan kapag may backend na */}
          {submitted && (
            <p className={styles.successText}>
              Valid ang form. (Wala pang backend kaya dito muna
              natatapos — walang totoong login na nangyayari.)
            </p>
          )}
        </form>

        <p className={styles.footNote}>
          Wala pang account?{' '}
          <Link to="/login" className={styles.footLink}>
            Mag-sign up
          </Link>
        </p>
      </div>
    </section>
  )
}

export default Login
