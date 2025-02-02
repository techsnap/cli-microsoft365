import { User } from '@microsoft/microsoft-graph-types';
import { Logger } from '../../../../cli';
import GlobalOptions from '../../../../GlobalOptions';
import { odata, validation } from '../../../../utils';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  role?: string;
  groupId: string;
}

class AadO365GroupUserListCommand extends GraphCommand {
  public get name(): string {
    return commands.O365GROUP_USER_LIST;
  }

  public get description(): string {
    return "Lists users for the specified Microsoft 365 group";
  }

  constructor() {
    super();
  
    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
  }
  
  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        role: args.options.role
      });
    });
  }
  
  #initOptions(): void {
    this.options.unshift(
      {
        option: "-i, --groupId <groupId>"
      },
      {
        option: "-r, --role [type]",
        autocomplete: ["Owner", "Member", "Guest"]
      }
    );
  }
  
  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (!validation.isValidGuid(args.options.groupId as string)) {
          return `${args.options.groupId} is not a valid GUID`;
        }
    
        if (args.options.role) {
          if (['Owner', 'Member', 'Guest'].indexOf(args.options.role) === -1) {
            return `${args.options.role} is not a valid role value. Allowed values Owner|Member|Guest`;
          }
        }
    
        return true;
      }
    );
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      let users = await this.getOwners(logger, args.options.groupId);

      if (args.options.role !== 'Owner') {
        const membersAndGuests = await this.getMembersAndGuests(logger, args.options.groupId);
        users = users.concat(membersAndGuests);
      }

      if (args.options.role) {
        users = users.filter(i => i.userType === args.options.role);
      }

      logger.log(users);
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }

  private getOwners(logger: Logger, groupId: string): Promise<User[]> {
    const endpoint: string = `${this.resource}/v1.0/groups/${groupId}/owners?$select=id,displayName,userPrincipalName,userType`;

    return odata
      .getAllItems<User>(endpoint)
      .then(users => {
        // Currently there is a bug in the Microsoft Graph that returns Owners as
        // userType 'member'. We therefore update all returned user as owner
        users.forEach(user => {
          user.userType = 'Owner';
        });

        return users;
      });
  }

  private getMembersAndGuests(logger: Logger, groupId: string): Promise<User[]> {
    const endpoint: string = `${this.resource}/v1.0/groups/${groupId}/members?$select=id,displayName,userPrincipalName,userType`;
    return odata.getAllItems<User>(endpoint);
  }
}

module.exports = new AadO365GroupUserListCommand();