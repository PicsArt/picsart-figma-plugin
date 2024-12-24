type FetchProps = RequestInit & {
    body? : object
}

export const customFetch = async (url : string, options? : FetchProps) : Promise<Response> => {
    const defaultHeaders = {};

    let updatedOptions: FetchProps = {
        ...(options || {}), 
        headers: { ...(options?.headers || {}), ...defaultHeaders },
    };
    return await fetch(url, updatedOptions);
}