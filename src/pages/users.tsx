import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { UserBadge, type User } from "@root/components/userBadge"
import { UserList } from "@root/components/userList"

const users: User[] = [
  { id: 1, name: "Anna de Vries", role: "Designer", email: "anna@example.com" },
  { id: 2, name: "Bram Jansen", role: "Developer", email: "bram@example.com" },
  { id: 3, name: "Chris Bakker", role: "Product owner", email: "chris@example.com" },
  { id: 4, name: "Dewi Smit", role: "Tester", email: "dewi@example.com" },
]

export class Page extends MithrilTsxComponent<{}> {
  selected: User | null = null

  view() {
    return <div className="stack">
      <h1 className="fs1">Users</h1>
      <div className="users-layout">
        <UserList
          users={users}
          selectedId={this.selected?.id}
          onselect={user => this.selected = user}
        />
        {this.selected
          ? <UserBadge user={this.selected} />
          : <p className="subtitle">Click a user to see their details.</p>}
      </div>
    </div>
  }
}
