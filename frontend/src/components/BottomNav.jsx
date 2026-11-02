import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, ClipboardList, CreditCard, Home, HelpCircle, LogOut, MoreHorizontal, User } from 'lucide-react';
import Modal from './common/Modal';

/**
 * The customer portal's bottom bar, locked to the bottom of the screen on a phone or a tablet.
 *
 * The four destinations a resident actually uses are one thumb-reach away on every page, which is
 * why they are here and not only on the home page.
 *
 * **It is `lg:hidden`, and the home page's Quick Access is `hidden lg:block` -- one pair, one
 * breakpoint.** They are the same four destinations, so at any width where both showed the portal
 * offered its navigation twice: a bar across the bottom and a column of cards saying the same
 * thing. Below `lg` the bar is the navigation and the cards are gone; at `lg` and above the cards
 * are, because a bar pinned across a 1440px window is a phone pattern wearing a desktop's clothes.
 * Moving one of those classes without the other brings the duplication back, or leaves a width
 * with no navigation at all.
 *
 * "More" is the fifth tab because a bar of five is the most that stays legible at 360px: it opens
 * the account itself -- who is signed in, the property, Contact / Help and Sign Out.
 */
const TABS = [
  { label: 'Home', icon: Home, path: '/dashboard', exact: true },
  { label: 'Work Orders', icon: ClipboardList, path: '/dashboard/work-order' },
  { label: 'Payments', icon: CreditCard, path: '/dashboard/payment' },
  { label: 'Schedules', icon: Calendar, path: '/dashboard/schedule' },
];

const isActive = (tab, pathname) => (tab.exact
  ? pathname === tab.path || pathname === `${tab.path}/`
  : pathname.startsWith(tab.path));

const BottomNav = ({ user, onLogout }) => {
  const { pathname } = useLocation();
  const [showMore, setShowMore] = useState(false);

  // Navigating away closes the sheet; leaving it open over a page the customer has already moved
  // on from is how a sheet ends up blocking the screen it was opened from.
  useEffect(() => { setShowMore(false); }, [pathname]);

  const moreActive = showMore || pathname.startsWith('/dashboard/contact');
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  // The pill, and the focus ring a keyboard needs to see where it is. The tabs are grid items with
  // no height of their own: they stretch to the row, so the 48px target comes from
  // `--portal-nav-h` less these margins, and there is no second height to keep in step.
  const tabClass = (active) => `flex flex-col items-center justify-center gap-1 mx-1 my-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500 ${
    active ? 'bg-gold-600/10 text-gold-600' : 'text-gray-500 hover:text-gold-600'
  }`;

  const labelClass = (active) => `text-[10px] leading-none whitespace-nowrap ${active ? 'font-semibold' : 'font-medium'}`;

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        {/* The bar spans the screen; the tabs inside it do not. Five items sharing a tablet's full
            width are 150px each with a 20px icon adrift in the middle, so the row is capped and
            centred -- below `max-w-xl` the cap does nothing and a phone's tabs still divide the
            whole width. */}
        <div className="grid grid-cols-5 h-[var(--portal-nav-h)] w-full max-w-xl mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab, pathname);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={tabClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className={labelClass(active)}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={tabClass(moreActive)}
            aria-haspopup="dialog"
            aria-expanded={showMore}
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            <span className={labelClass(moreActive)}>More</span>
          </button>
        </div>
      </nav>

      {showMore && (
        <Modal
          onClose={() => setShowMore(false)}
          align="bottom"
          // The sheet rests on top of the bar, not over it: `p-3` alone put its bottom edge 12px
          // from the viewport, which is across the bar that opened it and under an iPhone's home
          // indicator. The bottom padding is the bar plus that inset plus the same 12px, so the
          // More tab stays visible and lit while its sheet is open.
          padding="px-3 pt-3"
          // `lg:hidden` belongs to the overlay, not the card: hiding only the card at a width the
          // bar itself is hidden at would leave a transparent `fixed inset-0` swallowing clicks.
          overlayClassName="lg:hidden pb-[calc(var(--portal-nav-space)_+_0.75rem)]"
          className="max-w-md overflow-hidden"
          ariaLabelledBy="more-sheet-name"
        >
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <div className="w-11 h-11 bg-gold-600/15 border border-gold-500/30 rounded-full flex items-center justify-center shrink-0">
              {initials ? (
                <span className="text-gold-600 font-semibold text-sm">{initials}</span>
              ) : (
                <User className="w-5 h-5 text-gold-600" />
              )}
            </div>
            <div className="min-w-0">
              <p id="more-sheet-name" className="font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              {user?.propertyCode && (
                <p className="text-xs text-gold-600 truncate">Property ID: {user.propertyCode}</p>
              )}
            </div>
          </div>

          <div className="p-2">
            <Link
              to="/dashboard/contact"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gold-600" />
              <span>Contact / Help</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default BottomNav;
