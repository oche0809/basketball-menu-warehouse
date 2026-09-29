import { BackupMenu } from './components/BackupMenu'
import { Layout } from './components/Layout'
import { MenuForm } from './components/MenuForm'
import { HomePage } from './pages/HomePage'
import { MenuDetailPage } from './pages/MenuDetailPage'
import { MenuListPage } from './pages/MenuListPage'
import { PlanPage } from './pages/PlanPage'
import { RunPage } from './pages/RunPage'
import { SavedPlanDetail, SavedPlansList } from './pages/SavedPlansPage'
import { usePracticePlan } from './utils/plan'
import { planFromProposal } from './utils/aiPlan'
import { planFromSaved, useSavedPlans } from './utils/savedPlans'
import { usePracticeSession } from './utils/session'
import type { SavedPlan } from './types/menu'
import { navigate, useHashRoute } from './utils/router'
import { useMenus } from './utils/storage'
import { hasAnimation, hasBrokenAnimation } from './utils/animation'

function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-slate-500">メニューが見つかりません。</p>
      <a href="#/menus" className="mt-4 inline-block font-bold text-orange-700 hover:underline">一覧へ戻る</a>
    </div>
  )
}

export default function App() {
  const { segments, params } = useHashRoute()
  const { menus, addMenu, updateMenu, deleteMenu, toggleFavorite, replaceMenus } = useMenus()
  const { replacePlan, ...planActions } = usePracticePlan(menus)
  const session = usePracticeSession(planActions.items)
  const { savedPlans, savePlan, deleteSaved, toggleSavedFavorite, replaceSaved } = useSavedPlans()

  // 保存済み計画を現在の計画へコピーして、練習計画画面で確認・編集できるようにする
  const applySavedPlan = (saved: SavedPlan) => {
    replacePlan(planFromSaved(saved, new Set(menus.map((m) => m.id))))
    session.reset()
    navigate('/plan')
  }
  const [page = 'home', id] = segments
  const menu = id ? menus.find((m) => m.id === id) : undefined

  let content
  if (page === 'menus' && id) {
    content = menu ? (
      <MenuDetailPage
        key={menu.id}
        menu={menu}
        onToggleFavorite={toggleFavorite}
        onSaveAnimation={(menuId, animation) => updateMenu(menuId, { animation })}
        onDelete={(menuId) => {
          deleteMenu(menuId)
          navigate('/menus')
        }}
      />
    ) : (
      <NotFound />
    )
  } else if (page === 'menus' || page === 'favorites') {
    content = (
      <MenuListPage
        key={page + params.toString()}
        menus={menus}
        onToggleFavorite={toggleFavorite}
        favoritesOnly={page === 'favorites'}
        initialCategory={params.get('category') ?? undefined}
        onAddMenus={page === 'favorites' ? undefined : (inputs) => inputs.forEach(addMenu)}
        onSaveAnimations={
          page === 'favorites'
            ? undefined
            : (items) => {
                // 保存直前にもう一度確認：すでに動きがある（内蔵を含む）メニューには保存しない
                const targets = items.filter(({ id }) => {
                  const menu = menus.find((m) => m.id === id)
                  return menu && !hasAnimation(menu) && !hasBrokenAnimation(menu)
                })
                targets.forEach(({ id, animation }) => updateMenu(id, { animation }))
                return targets.length
              }
        }
      />
    )
  } else if (page === 'new') {
    content = (
      <MenuForm
        heading="メニューを追加"
        onSubmit={(input) => {
          addMenu(input)
          navigate('/menus')
        }}
        onCancel={() => navigate('/menus')}
      />
    )
  } else if (page === 'edit') {
    content = menu ? (
      <MenuForm
        key={menu.id}
        heading="メニューを編集"
        initial={menu}
        onSubmit={(input) => {
          updateMenu(menu.id, input)
          navigate(`/menus/${menu.id}`)
        }}
        onCancel={() => navigate(`/menus/${menu.id}`)}
      />
    ) : (
      <NotFound />
    )
  } else if (page === 'plan' && id === 'run') {
    content = <RunPage plan={planActions.plan} menus={menus} session={session} />
  } else if (page === 'plan') {
    content = (
      <PlanPage menus={menus} session={session} savedCount={savedPlans.length} onSavePlan={() => savePlan(planActions.getPlan(), menus)}
        onApplyProposal={(proposal, conditions) => {
          // 確認ダイアログで「この計画を使う」を確定したときだけ、現在の計画を置き換える
          replacePlan(planFromProposal(planActions.getPlan(), proposal, conditions))
          session.reset()
        }}
        {...planActions}
      />
    )
  } else if (page === 'saved') {
    const saved = id ? savedPlans.find((p) => p.id === id) : undefined
    content = !id ? (
      <SavedPlansList
        plans={savedPlans}
        menus={menus}
        hasCurrentPlan={planActions.items.length > 0}
        onUse={applySavedPlan}
        onToggleFavorite={toggleSavedFavorite}
      />
    ) : saved ? (
      <SavedPlanDetail
        plan={saved}
        menus={menus}
        hasCurrentPlan={planActions.items.length > 0}
        onUse={() => applySavedPlan(saved)}
        onToggleFavorite={() => toggleSavedFavorite(saved.id)}
        onDelete={() => {
          deleteSaved(saved.id)
          navigate('/saved')
        }}
      />
    ) : (
      <div className="py-16 text-center">
        <p className="text-slate-500">保存済み計画が見つかりません。</p>
        <a href="#/saved" className="mt-4 inline-block font-bold text-orange-700 hover:underline">
          保存済み一覧へ
        </a>
      </div>
    )
  } else {
    content = <HomePage menus={menus} />
  }

  const backup = (
    <BackupMenu
      menus={menus}
      plan={planActions.plan}
      savedPlans={savedPlans}
      onImport={(data) => {
        replaceMenus(data.menus)
        if (data.plan) replacePlan(data.plan)
        if (data.savedPlans) replaceSaved(data.savedPlans)
        navigate('/menus')
      }}
    />
  )

  return (
    <Layout current={page} actions={backup}>
      {content}
    </Layout>
  )
}
