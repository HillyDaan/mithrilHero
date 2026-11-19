import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import type { User } from "@root/components/userBadge"

export interface IUserList {
  users: User[]
  selectedId?: number
  onselect: (user: User) => void
}

export class UserList extends MithrilTsxComponent<IUserList> {
  view(v: m.Vnode<IUserList>) {
    return <ul className="user-list">
      {v.attrs.users.map(user =>
        <li key={user.id}>
          <button
            className={user.id === v.attrs.selectedId ? "user-list-item selected" : "user-list-item"}
            onclick={() => v.attrs.onselect(user)}
          >
            {user.name}
          </button>
        </li>
      )}
    </ul>
  }
}
