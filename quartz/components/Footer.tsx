// import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// import style from "./styles/footer.scss"
// import { version } from "../../package.json"
// import { i18n } from "../i18n"

// interface Options {
//   links: Record<string, string>
// }

// export default ((opts?: Options) => {
//   const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
//     const year = new Date().getFullYear()
//     const links = opts?.links ?? []
//     return (
//       <footer class={`${displayClass ?? ""}`}>
//         <p>
//           {i18n(cfg.locale).components.footer.createdWith}{" "}
//           <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
//         </p>
//         <ul>
//           {Object.entries(links).map(([text, link]) => (
//             <li>
//               <a href={link}>{text}</a>
//             </li>
//           ))}
//         </ul>
//       </footer>
//     )
//   }

//   Footer.css = style
//   return Footer
// }) satisfies QuartzComponentConstructor


import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"

interface Options {
  links: Record<string, string>
}

const iconMap: Record<string, string> = {
  GitHub: "fab fa-github",
  LinkedIn: "fab fa-linkedin",
  "Naver Blog": "fas fa-blog"
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const links = opts?.links ?? []

    return (
      <footer class={`${displayClass ?? ""}`}>
        <p dangerouslySetInnerHTML={{ __html: `
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
        ` }} />
        <p>
          {i18n(cfg.locale).components.footer.createdWith}{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
        </p>
        <ul>
  {Object.entries(links).map(([text, link]) => {
    const iconClass = iconMap[text]
    return (
      <li>
        <a href={link} target="_blank" rel="noopener noreferrer">
          {iconClass && (
            <i
              class={iconClass}
              style="margin: 0 5px; font-size: 1.5rem; color: #6A0DAD;"
            />
          )}
        </a>
      </li>
    )
  })}
</ul>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor