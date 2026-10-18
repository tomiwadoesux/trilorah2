import { ScriptureRow } from './rows/ScriptureRow';
import { SongsRow } from './rows/SongsRow';
import { ServiceRow } from './rows/ServiceRow';
import { ScreensRow } from './rows/ScreensRow';
import { CompanionRow } from './rows/CompanionRow';
import { PhoneRow } from './rows/PhoneRow';

/** The product showcase on /home: five rows of real product UI, after the #workflow bento. */
export function ProductShowcase() {
  return (
    <div className="sc-showcase">
      <ScriptureRow />
      <SongsRow />
      <ServiceRow />
      <ScreensRow />
      <PhoneRow />
      <CompanionRow />
    </div>
  );
}
