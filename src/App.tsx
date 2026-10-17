import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./lib/app";
import { CONFIGURED } from "./lib/backend";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { SignInPrompt, Spinner, EmptyState } from "./components/ui";

const Home = lazy(() => import("./pages/Home"));
const WellnessCenter = lazy(() => import("./pages/Centers").then((m) => ({ default: m.WellnessCenter })));
const PerspectiveCenter = lazy(() => import("./pages/Centers").then((m) => ({ default: m.PerspectiveCenter })));
const TopicPage = lazy(() => import("./pages/Centers").then((m) => ({ default: m.TopicPage })));
const ArticlePage = lazy(() => import("./pages/ArticlePage"));
const Manifesto = lazy(() => import("./pages/Manifesto"));
const JourneyPage = lazy(() => import("./pages/Journey"));
const Reflection = lazy(() => import("./pages/Reflection"));
const Resources = lazy(() => import("./pages/Resources"));
const Info = () => import("./pages/Info");
const About = lazy(() => Info().then((m) => ({ default: m.About })));
const Research = lazy(() => Info().then((m) => ({ default: m.Research })));
const GetHelp = lazy(() => Info().then((m) => ({ default: m.GetHelp })));
const PolicyPage = lazy(() => Info().then((m) => ({ default: m.PolicyPage })));
const NotFound = lazy(() => Info().then((m) => ({ default: m.NotFound })));
const Auth = () => import("./pages/Auth");
const SignIn = lazy(() => Auth().then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => Auth().then((m) => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => Auth().then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => Auth().then((m) => ({ default: m.ResetPassword })));
const Account = lazy(() => import("./pages/Account"));
const Notifications = lazy(() => import("./pages/Account").then((m) => ({ default: m.NotificationsPage })));
const Journal = lazy(() => import("./pages/Journal"));
const Library = lazy(() => import("./pages/Library"));
const Comm = () => import("./pages/Community");
const CommunityHome = lazy(() => Comm().then((m) => ({ default: m.CommunityHome })));
const CategoryPage = lazy(() => Comm().then((m) => ({ default: m.CategoryPage })));
const ThreadPage = lazy(() => Comm().then((m) => ({ default: m.ThreadPage })));
const NewThread = lazy(() => Comm().then((m) => ({ default: m.NewThread })));
const Msg = () => import("./pages/Messages");
const SupportHub = lazy(() => Msg().then((m) => ({ default: m.SupportHub })));
const MessagesList = lazy(() => Msg().then((m) => ({ default: m.MessagesList })));
const ConversationPage = lazy(() => Msg().then((m) => ({ default: m.ConversationPage })));
const AdminApp = lazy(() => import("./admin/AdminApp"));

function RequireAuth({ what, children }: { what: string; children: ReactNode }) {
  const { me, ready, user } = useApp();
  if (!ready || (user && !me)) return <Spinner />;
  if (!me) return <div className="container-page py-16"><SignInPrompt what={what} h1 /></div>;
  return <>{children}</>;
}

function Shell() {
  const { ready, loadError } = useApp();
  if (!ready) return <Spinner label="Opening #ChooseHappiness" />;
  if (loadError) return (
    <div className="container-page py-20">
      <EmptyState title="We couldn't load the site right now">Please refresh the page in a moment. If you are in crisis in the U.S., call or text 988.</EmptyState>
    </div>
  );
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wellness" element={<WellnessCenter />} />
          <Route path="perspective" element={<PerspectiveCenter />} />
          <Route path="topics/:slug" element={<TopicPage />} />
          <Route path="articles/:slug" element={<ArticlePage />} />
          <Route path="exercises/:slug" element={<ArticlePage />} />
          <Route path="manifesto" element={<Manifesto />} />
          <Route path="journey" element={<JourneyPage />} />
          <Route path="journey/:slug" element={<JourneyPage />} />
          <Route path="reflection" element={<Reflection />} />
          <Route path="resources" element={<Resources />} />
          <Route path="research" element={<Research />} />
          <Route path="about" element={<About />} />
          <Route path="get-help" element={<GetHelp />} />
          <Route path="privacy" element={<PolicyPage slug="privacy" />} />
          <Route path="terms" element={<PolicyPage slug="terms" />} />
          <Route path="guidelines" element={<PolicyPage slug="guidelines" />} />
          <Route path="pages/:slug" element={<PolicyPage />} />
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="support" element={<SupportHub />} />
          <Route path="community" element={<CommunityHome />} />
          <Route path="community/:slug" element={<RequireAuth what="read the discussions"><CategoryPage /></RequireAuth>} />
          <Route path="community/:slug/new" element={<RequireAuth what="start a discussion"><NewThread /></RequireAuth>} />
          <Route path="community/t/:id" element={<RequireAuth what="read this discussion"><ThreadPage /></RequireAuth>} />
          <Route path="journal" element={<RequireAuth what="use your private journal"><Journal /></RequireAuth>} />
          <Route path="library" element={<RequireAuth what="see your library"><Library /></RequireAuth>} />
          <Route path="messages" element={<RequireAuth what="see your messages"><MessagesList /></RequireAuth>} />
          <Route path="messages/:id" element={<RequireAuth what="see this conversation"><ConversationPage /></RequireAuth>} />
          <Route path="notifications" element={<RequireAuth what="see notifications"><Notifications /></RequireAuth>} />
          <Route path="account" element={<RequireAuth what="manage your account"><Account /></RequireAuth>} />
          <Route path="admin/*" element={<RequireAuth what="open the admin area"><AdminApp /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotConfigured() {
  return (
    <main className="container-read py-20">
      <h1 className="text-3xl">This site isn't connected yet</h1>
      <p className="mt-4">The website needs its Supabase settings (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). See the README section "Connect Supabase".</p>
      <p className="mt-4">If you are in crisis in the U.S., call or text <a className="link" href="tel:988">988</a>. In an emergency, call 911.</p>
    </main>
  );
}

export default function App() {
  if (!CONFIGURED) return <NotConfigured />;
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
