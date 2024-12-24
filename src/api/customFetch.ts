import { HEADER_PLUGIN_NAME_KEY, HEADER_PLUGIN_NAME_VALUE } from "@constants/url";

type FetchProps = RequestInit & {
    body? : object
}

export const customFetch = async (url : string, options? : FetchProps) : Promise<Response> => {
    const defaultHeaders = {
        [HEADER_PLUGIN_NAME_KEY]: HEADER_PLUGIN_NAME_VALUE,
    };
    
    let updatedOptions: FetchProps = {
        ...(options || {}), 
        headers: { ...(options?.headers || {}), ...defaultHeaders },
    };
    console.log(updatedOptions);
    return await fetch(url, updatedOptions);
}