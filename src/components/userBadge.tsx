import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"

export interface User {
  id: number
  name: string
  role: string
  email: string
}

export interface IUserBadge {
  user: User
}

export class UserBadge extends MithrilTsxComponent<IUserBadge> {
  view(v: m.Vnode<IUserBadge>) {
    const { user } = v.attrs
    const initials = user.name.split(" ").map(x => x[0]).join("").slice(0, 2)

    return <div className="card user-badge">
      <div className="user-avatar">{initials}</div>
      <div>
        <h2 className="user-badge-name">{user.name}</h2>
        <p>{user.role}</p>
        <p className="user-badge-email">{user.email}</p>
      </div>
    </div>
  }
}
